package com.annamithra.service;

import com.annamithra.dto.PrepareDispatchRequest;
import com.annamithra.model.BranchRequest;
import com.annamithra.model.Dispatch;
import com.annamithra.model.DispatchReturn;
import com.annamithra.model.InventoryTransaction;
import com.annamithra.model.Item;
import com.annamithra.repository.BranchRequestRepository;
import com.annamithra.repository.DispatchRepository;
import com.annamithra.repository.DispatchReturnRepository;
import com.annamithra.repository.InventoryTransactionRepository;
import com.annamithra.repository.ItemRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@SuppressWarnings("null")
public class DispatchService {
    private final DispatchRepository dispatchRepo;
    private final BranchRequestRepository requestRepo;
    private final ItemRepository itemRepo;
    private final InventoryTransactionRepository transactionRepo;
    private final DispatchReturnRepository returnRepo;

    public DispatchService(DispatchRepository dispatchRepo, BranchRequestRepository requestRepo,
                           ItemRepository itemRepo, InventoryTransactionRepository transactionRepo,
                           DispatchReturnRepository returnRepo) {
        this.dispatchRepo = dispatchRepo;
        this.requestRepo = requestRepo;
        this.itemRepo = itemRepo;
        this.transactionRepo = transactionRepo;
        this.returnRepo = returnRepo;
    }

    private final java.util.concurrent.ConcurrentHashMap<String, Long> recentDispatchSubmissions = new java.util.concurrent.ConcurrentHashMap<>();

    // Store Manager: Multi-item dispatch
    @Transactional
    public List<Dispatch> prepareAndDispatch(PrepareDispatchRequest req, String storeManagerUsername, Long orgId) {
        if (req == null || req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dispatch list must contain at least one item");
        }
        if (req.branchName == null || req.branchName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch name is required for dispatch");
        }

        String branchName = req.branchName.trim();

        // Prevent duplicate dispatch submissions (e.g. rapid double-clicks or replays)
        String submissionKey = (orgId != null ? orgId : 0L) + ":" + branchName.toLowerCase() + ":" + req.items.stream()
            .map(i -> (i.itemName != null ? i.itemName.toLowerCase().trim() : "") + "_" + i.dispatchQty)
            .reduce("", (a, b) -> a + ";" + b);
        long currentTime = System.currentTimeMillis();
        Long lastTime = recentDispatchSubmissions.get(submissionKey);
        if (lastTime != null && (currentTime - lastTime) < 2000) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate dispatch submission detected. Please wait a moment.");
        }
        recentDispatchSubmissions.put(submissionKey, currentTime);
        if (recentDispatchSubmissions.size() > 200) {
            recentDispatchSubmissions.entrySet().removeIf(e -> (currentTime - e.getValue()) > 10000);
        }

        List<PrepareDispatchRequest.DispatchItemLine> validLines = new ArrayList<>();

        for (PrepareDispatchRequest.DispatchItemLine line : req.items) {
            if (line.dispatchQty <= 0) {
                continue; // Skip lines with 0 dispatch quantity
            }
            if (line.itemName == null || line.itemName.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name cannot be blank");
            }
            validLines.add(line);
        }

        if (validLines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter at least one item with a positive dispatch quantity");
        }

        // Support consolidated dispatches: If a requested line does not specify a single requestId,
        // auto-allocate across unfulfilled requests for that branch and item in FIFO order
        List<PrepareDispatchRequest.DispatchItemLine> expandedLines = new ArrayList<>();
        for (PrepareDispatchRequest.DispatchItemLine line : validLines) {
            if (line.requestId == null && !line.isAdditional) {
                List<BranchRequest> unfulfilled = (orgId != null)
                    ? requestRepo.findOutstandingForOrganisationAndBranchAndItem(orgId, branchName, line.itemName)
                    : requestRepo.findOutstandingForBranchAndItem(branchName, line.itemName);

                double needed = line.dispatchQty;
                for (BranchRequest br : unfulfilled) {
                    if (needed <= 0) break;
                    double rem = br.getRemainingToDispatch();
                    if (rem <= 0) continue;
                    double toAlloc = Math.min(needed, rem);
                    PrepareDispatchRequest.DispatchItemLine sub = new PrepareDispatchRequest.DispatchItemLine();
                    sub.requestId = br.id;
                    sub.itemName = br.item;
                    sub.unit = br.unit;
                    sub.dispatchQty = toAlloc;
                    sub.isAdditional = false;
                    expandedLines.add(sub);
                    needed -= toAlloc;
                }
                if (needed > 0) {
                    PrepareDispatchRequest.DispatchItemLine add = new PrepareDispatchRequest.DispatchItemLine();
                    add.requestId = null;
                    add.itemName = line.itemName;
                    add.unit = line.unit;
                    add.dispatchQty = needed;
                    add.isAdditional = true;
                    expandedLines.add(add);
                }
            } else {
                expandedLines.add(line);
            }
        }
        validLines = expandedLines;

        // 1. Validate branch request outstanding limits
        Map<Long, BranchRequest> requestMap = new HashMap<>();
        for (PrepareDispatchRequest.DispatchItemLine line : validLines) {
            if (line.requestId != null) {
                BranchRequest br = requestRepo.findById(line.requestId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Branch request #" + line.requestId + " not found"));
                
                if (!br.branch.equalsIgnoreCase(branchName)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request #" + line.requestId + " belongs to branch " + br.branch + ", not " + branchName);
                }
                if (orgId != null && br.organisationId != null && !br.organisationId.equals(orgId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Request belongs to another organisation");
                }

                double remainingToDispatch = br.getRemainingToDispatch();
                if (line.dispatchQty > remainingToDispatch) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Dispatch quantity (" + line.dispatchQty + ") for " + br.item + " exceeds outstanding requested amount (" + remainingToDispatch + ")");
                }
                requestMap.put(line.requestId, br);
            }
        }

        // 2. Lookup or initialize item records in central warehouse (stock does NOT restrict dispatch)
        Map<String, Double> totalItemQuantities = new HashMap<>();
        Map<String, String> itemUnits = new HashMap<>();
        for (PrepareDispatchRequest.DispatchItemLine line : validLines) {
            String key = line.itemName.trim().toLowerCase();
            totalItemQuantities.put(key, totalItemQuantities.getOrDefault(key, 0.0) + line.dispatchQty);
            if (line.unit != null && !line.unit.isBlank()) {
                itemUnits.put(key, line.unit.trim().toUpperCase());
            }
        }

        Map<String, Item> itemMap = new HashMap<>();
        for (Map.Entry<String, Double> entry : totalItemQuantities.entrySet()) {
            String fallbackUnit = itemUnits.getOrDefault(entry.getKey(), "KG");
            Item item = (orgId != null)
                ? itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, entry.getKey())
                    .orElseGet(() -> {
                        Item ni = new Item(entry.getKey(), fallbackUnit, 0);
                        ni.organisationId = orgId;
                        return itemRepo.save(ni);
                    })
                : itemRepo.findByNameIgnoreCase(entry.getKey())
                    .orElseGet(() -> itemRepo.save(new Item(entry.getKey(), fallbackUnit, 0)));

            itemMap.put(entry.getKey(), item);
        }

        // 3. Process dispatch transaction atomically
        String dispatchBatch = "DSP-" + System.currentTimeMillis();
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        List<Dispatch> savedDispatches = new ArrayList<>();

        for (PrepareDispatchRequest.DispatchItemLine line : validLines) {
            String itemKey = line.itemName.trim().toLowerCase();
            Item item = itemMap.get(itemKey);

            double previousStock = item.stock;
            // Deduct actual quantity from central warehouse transparently (reflects accurate stock / deficit)
            item.stock -= line.dispatchQty;
            itemRepo.save(item);

            // Create dispatch record with responsible user
            Dispatch dispatch = new Dispatch();
            dispatch.dispatchNumber = dispatchBatch;
            dispatch.dispatchDate = today;
            dispatch.createdAt = now;
            dispatch.branchName = branchName;
            dispatch.itemName = item.name;
            if (line.requestId != null && requestMap.containsKey(line.requestId)) {
                BranchRequest br = requestMap.get(line.requestId);
                dispatch.department = br.getDepartment() != null ? br.getDepartment() : "General";
            } else if (line.department != null && !line.department.isBlank()) {
                dispatch.department = line.department.trim();
            } else {
                dispatch.department = (item.category != null && !item.category.isBlank()) ? item.category.trim() : "General";
            }
            dispatch.unit = (line.unit != null && !line.unit.isBlank()) ? line.unit.trim().toUpperCase() : item.unit;
            dispatch.quantity = line.dispatchQty;
            dispatch.isAdditional = line.isAdditional || (line.requestId == null);
            dispatch.requestId = line.requestId;
            dispatch.status = "PENDING";
            dispatch.acknowledgedQuantity = 0;
            dispatch.organisationId = orgId;
            dispatch.dispatchedBy = storeManagerUsername != null ? storeManagerUsername : "Store Manager";

            Dispatch saved = dispatchRepo.save(dispatch);
            savedDispatches.add(saved);

            // Record audit transaction in inventory ledger
            InventoryTransaction tx = new InventoryTransaction(
                orgId,
                item.name,
                dispatch.unit,
                "DISPATCH",
                line.dispatchQty,
                "DISPATCH",
                saved.id,
                item.stock,
                storeManagerUsername != null ? storeManagerUsername : "Store Manager"
            );
            tx.transactionDate = now;
            transactionRepo.save(tx);

            // Preserve an explicit stock adjustment / deficit record when dispatch exceeds available stock
            if (previousStock < line.dispatchQty) {
                double deficit = line.dispatchQty - Math.max(0.0, previousStock);
                InventoryTransaction adjustTx = new InventoryTransaction(
                    orgId,
                    item.name,
                    dispatch.unit,
                    "DISPATCH_DEFICIT_ADJUSTMENT",
                    deficit,
                    "DISPATCH_DEFICIT",
                    saved.id,
                    item.stock,
                    storeManagerUsername != null ? storeManagerUsername : "Store Manager"
                );
                adjustTx.transactionDate = now;
                transactionRepo.save(adjustTx);
            }

            // Update branch request dispatched amount if linked
            if (line.requestId != null && requestMap.containsKey(line.requestId)) {
                BranchRequest br = requestMap.get(line.requestId);
                br.dispatched += line.dispatchQty;
                if (br.dispatched >= br.requested) {
                    br.status = "DISPATCHED";
                } else if (br.dispatched > 0) {
                    br.status = "PARTIALLY_DISPATCHED";
                }
                requestRepo.save(br);
            }
        }

        return savedDispatches;
    }

    // Store Manager: Dispatch history with acknowledgement status
    public List<Dispatch> getStoreDispatchHistory(String branch, LocalDate date, LocalDate fromDate, LocalDate toDate, String item, Long orgId) {
        List<Dispatch> all = (orgId != null)
            ? dispatchRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : dispatchRepo.findAllByOrderByCreatedAtDesc();

        return all.stream()
            .filter(d -> branch == null || branch.isBlank() || d.branchName.equalsIgnoreCase(branch.trim()))
            .filter(d -> {
                LocalDate dDate = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                if (date != null) {
                    return dDate != null && dDate.equals(date);
                }
                if (fromDate != null && (dDate == null || dDate.isBefore(fromDate))) return false;
                if (toDate != null && (dDate == null || dDate.isAfter(toDate))) return false;
                return true;
            })
            .filter(d -> item == null || item.isBlank() || d.itemName.toLowerCase().contains(item.trim().toLowerCase()))
            .toList();
    }

    // Branch Manager: Deliveries sent to the branch
    public List<Dispatch> getBranchDeliveries(String branchName, LocalDate date, LocalDate fromDate, LocalDate toDate, Long orgId) {
        if (branchName == null || branchName.isBlank()) {
            return Collections.emptyList();
        }
        List<Dispatch> all = (orgId != null)
            ? dispatchRepo.findByOrganisationIdAndBranchNameIgnoreCaseOrderByCreatedAtDesc(orgId, branchName.trim())
            : dispatchRepo.findByBranchNameIgnoreCaseOrderByCreatedAtDesc(branchName.trim());

        return all.stream()
            .filter(d -> {
                LocalDate dDate = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                if (date != null) {
                    return dDate != null && dDate.equals(date);
                }
                if (fromDate != null && (dDate == null || dDate.isBefore(fromDate))) return false;
                if (toDate != null && (dDate == null || dDate.isAfter(toDate))) return false;
                return true;
            })
            .toList();
    }

    // Branch Manager: History of deliveries actually received (acknowledged)
    public List<Dispatch> getBranchReceivedHistory(String branchName, LocalDate date, LocalDate fromDate, LocalDate toDate, String item, Long orgId) {
        if (branchName == null || branchName.isBlank()) {
            return Collections.emptyList();
        }
        List<Dispatch> all = (orgId != null)
            ? dispatchRepo.findByOrganisationIdAndBranchNameIgnoreCaseAndStatusIgnoreCaseOrderByCreatedAtDesc(orgId, branchName.trim(), "ACKNOWLEDGED")
            : dispatchRepo.findByBranchNameIgnoreCaseAndStatusIgnoreCaseOrderByCreatedAtDesc(branchName.trim(), "ACKNOWLEDGED");

        return all.stream()
            .filter(d -> {
                LocalDate ackDate = d.acknowledgedAt != null ? d.acknowledgedAt.toLocalDate() : d.dispatchDate;
                if (date != null) {
                    return ackDate != null && ackDate.equals(date);
                }
                if (fromDate != null && (ackDate == null || ackDate.isBefore(fromDate))) return false;
                if (toDate != null && (ackDate == null || ackDate.isAfter(toDate))) return false;
                return true;
            })
            .filter(d -> item == null || item.isBlank() || d.itemName.toLowerCase().contains(item.trim().toLowerCase()))
            .toList();
    }

    // Branch Manager: Confirm physical receipt (acknowledge)
    @Transactional
    public Dispatch acknowledgeDispatch(Long dispatchId, Double actualReceivedQty, String remarks, String managerBranch, String managerUsername, Long orgId) {
        if (dispatchId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dispatch ID cannot be null");
        }
        Dispatch d = dispatchRepo.findById(dispatchId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispatch record not found with ID " + dispatchId));

        if (!d.branchName.equalsIgnoreCase(managerBranch.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: This delivery is destined for " + d.branchName + ", not " + managerBranch);
        }
        if (orgId != null && d.organisationId != null && !d.organisationId.equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access delivery from another organisation");
        }

        if ("ACKNOWLEDGED".equalsIgnoreCase(d.status) || d.acknowledgedAt != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Delivery has already been acknowledged");
        }

        double receivedQty = (actualReceivedQty != null) ? actualReceivedQty : d.quantity;
        if (receivedQty < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actual received quantity cannot be negative");
        }
        if (receivedQty > d.quantity) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Actual received quantity (" + receivedQty + " " + d.unit + ") cannot exceed dispatched quantity (" + d.quantity + " " + d.unit + ")");
        }

        double shortage = d.quantity - receivedQty;

        d.status = "ACKNOWLEDGED";
        d.acknowledgedQuantity = receivedQty;
        d.shortageQuantity = shortage;
        d.acknowledgementStatus = (shortage <= 0) ? "FULLY_RECEIVED" : (receivedQty > 0 ? "PARTIALLY_RECEIVED" : "NOT_RECEIVED");
        d.acknowledgementRemarks = (remarks != null && !remarks.isBlank()) ? remarks.trim() : null;
        d.acknowledgedAt = LocalDateTime.now();
        d.acknowledgedBy = managerUsername != null ? managerUsername : (managerBranch + " Manager");

        // If linked to branch request, update confirmed received quantity with actual quantity received
        if (d.requestId != null && receivedQty > 0) {
            requestRepo.findById(d.requestId).ifPresent(r -> {
                r.received += receivedQty;
                if (r.received >= r.requested) {
                    r.status = "COMPLETED";
                } else if (r.received > 0) {
                    r.status = "PARTIALLY_RECEIVED";
                }
                requestRepo.save(r);
            });
        }

        return dispatchRepo.save(d);
    }

    @Transactional
    public Dispatch acknowledgeDispatch(Long dispatchId, String managerBranch, String managerUsername, Long orgId) {
        return acknowledgeDispatch(dispatchId, null, null, managerBranch, managerUsername, orgId);
    }

    // Branch Manager: Return item to central store
    @Transactional
    public Dispatch returnDispatch(Long dispatchId, double returnQty, String reason, String managerBranch, String managerUsername, Long orgId) {
        if (dispatchId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dispatch ID cannot be null");
        }
        if (returnQty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return quantity must be greater than zero");
        }

        Dispatch d = dispatchRepo.findById(dispatchId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispatch record not found with ID " + dispatchId));

        if (!d.branchName.equalsIgnoreCase(managerBranch.trim())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: This delivery is destined for " + d.branchName + ", not " + managerBranch);
        }
        if (orgId != null && d.organisationId != null && !d.organisationId.equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access delivery from another organisation");
        }

        double alreadyReturned = d.returnedQuantity;
        double availableToReturn = d.quantity - alreadyReturned;

        if (returnQty > availableToReturn) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Return quantity (" + returnQty + ") exceeds available returnable quantity (" + availableToReturn + "). Dispatched: " + d.quantity + ", already returned: " + alreadyReturned);
        }

        LocalDateTime now = LocalDateTime.now();

        // 1. Update dispatch cumulative returnedQuantity and return info
        d.returnedQuantity = alreadyReturned + returnQty;
        d.returnedAt = now;
        if (reason != null && !reason.isBlank()) {
            d.returnReason = reason.trim();
        }
        Dispatch updatedDispatch = dispatchRepo.save(d);

        // 2. Save separate DispatchReturn record
        DispatchReturn ret = new DispatchReturn(
            d.id,
            d.dispatchNumber,
            d.branchName,
            d.itemName,
            d.unit,
            returnQty,
            reason != null ? reason.trim() : null,
            now,
            managerUsername != null ? managerUsername : (managerBranch + " Manager")
        );
        Long targetOrgId = d.organisationId != null ? d.organisationId : orgId;
        ret.organisationId = targetOrgId;
        DispatchReturn savedReturn = returnRepo.save(ret);

        // 3. Central inventory safety: Update central inventory item stock
        Item item = (targetOrgId != null)
            ? itemRepo.findByOrganisationIdAndNameIgnoreCase(targetOrgId, d.itemName).orElseGet(() -> {
                Item newItem = new Item(d.itemName, d.unit, 0);
                newItem.organisationId = targetOrgId;
                return itemRepo.save(newItem);
            })
            : itemRepo.findByNameIgnoreCase(d.itemName).orElseGet(() -> {
                Item newItem = new Item(d.itemName, d.unit, 0);
                return itemRepo.save(newItem);
            });

        item.stock += returnQty;
        itemRepo.save(item);

        // 4. Record audit transaction
        InventoryTransaction tx = new InventoryTransaction(
            item.name,
            item.unit,
            "RETURN",
            returnQty,
            "BRANCH_RETURN",
            savedReturn.id,
            item.stock,
            managerUsername != null ? managerUsername : (managerBranch + " Manager")
        );
        tx.organisationId = targetOrgId;
        transactionRepo.save(tx);

        return updatedDispatch;
    }

    public List<DispatchReturn> getDispatchReturns(Long dispatchId, Long orgId) {
        List<DispatchReturn> list = returnRepo.findByDispatchIdOrderByReturnDateDesc(dispatchId);
        if (orgId != null) {
            return list.stream().filter(r -> r.organisationId == null || r.organisationId.equals(orgId)).toList();
        }
        return list;
    }

    public List<DispatchReturn> getAllReturns(String branchName, Long orgId) {
        List<DispatchReturn> all;
        if (orgId != null) {
            all = returnRepo.findByOrganisationIdOrderByReturnDateDesc(orgId);
        } else {
            all = returnRepo.findAllByOrderByReturnDateDesc();
        }

        if (branchName != null && !branchName.isBlank()) {
            return all.stream().filter(r -> r.branchName.equalsIgnoreCase(branchName.trim())).toList();
        }
        return all;
    }
}
