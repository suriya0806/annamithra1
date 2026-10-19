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

                int needed = line.dispatchQty;
                for (BranchRequest br : unfulfilled) {
                    if (needed <= 0) break;
                    int rem = br.getRemainingToDispatch();
                    if (rem <= 0) continue;
                    int toAlloc = Math.min(needed, rem);
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

                int remainingToDispatch = br.getRemainingToDispatch();
                if (line.dispatchQty > remainingToDispatch) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Dispatch quantity (" + line.dispatchQty + ") for " + br.item + " exceeds outstanding requested amount (" + remainingToDispatch + ")");
                }
                requestMap.put(line.requestId, br);
            }
        }

        // 2. Validate total stock requirements across all lines (requested + additional)
        Map<String, Integer> totalItemQuantities = new HashMap<>();
        for (PrepareDispatchRequest.DispatchItemLine line : validLines) {
            String key = line.itemName.trim().toLowerCase();
            totalItemQuantities.put(key, totalItemQuantities.getOrDefault(key, 0) + line.dispatchQty);
        }

        Map<String, Item> itemMap = new HashMap<>();
        for (Map.Entry<String, Integer> entry : totalItemQuantities.entrySet()) {
            Item item = (orgId != null)
                ? itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, entry.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item '" + entry.getKey() + "' not found in warehouse"))
                : itemRepo.findByNameIgnoreCase(entry.getKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item '" + entry.getKey() + "' not found in warehouse"));

            if (item.stock < entry.getValue()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Insufficient stock for " + item.name + ": Requires " + entry.getValue() + " " + item.unit + ", but only " + item.stock + " " + item.unit + " available in central warehouse");
            }
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

            // Deduct from central warehouse
            item.stock -= line.dispatchQty;
            itemRepo.save(item);

            // Create dispatch record
            Dispatch dispatch = new Dispatch();
            dispatch.dispatchNumber = dispatchBatch;
            dispatch.dispatchDate = today;
            dispatch.createdAt = now;
            dispatch.branchName = branchName;
            dispatch.itemName = item.name;
            dispatch.unit = item.unit;
            dispatch.quantity = line.dispatchQty;
            dispatch.isAdditional = line.isAdditional || (line.requestId == null);
            dispatch.requestId = line.requestId;
            dispatch.status = "PENDING";
            dispatch.acknowledgedQuantity = 0;
            dispatch.organisationId = orgId;

            Dispatch saved = dispatchRepo.save(dispatch);
            savedDispatches.add(saved);

            // Record audit transaction
            InventoryTransaction tx = new InventoryTransaction(
                item.name,
                item.unit,
                "DISPATCH",
                line.dispatchQty,
                "DISPATCH",
                saved.id,
                item.stock,
                storeManagerUsername != null ? storeManagerUsername : "Store Manager"
            );
            tx.organisationId = orgId;
            transactionRepo.save(tx);

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
    public Dispatch acknowledgeDispatch(Long dispatchId, String managerBranch, String managerUsername, Long orgId) {
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

        if ("ACKNOWLEDGED".equalsIgnoreCase(d.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Delivery has already been acknowledged");
        }

        d.status = "ACKNOWLEDGED";
        d.acknowledgedAt = LocalDateTime.now();
        d.acknowledgedBy = managerUsername != null ? managerUsername : (managerBranch + " Manager");
        d.acknowledgedQuantity = d.quantity;

        // If linked to branch request, update confirmed received quantity
        if (d.requestId != null) {
            requestRepo.findById(d.requestId).ifPresent(r -> {
                r.received += d.quantity;
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

    // Branch Manager: Return item to central store
    @Transactional
    public Dispatch returnDispatch(Long dispatchId, int returnQty, String reason, String managerBranch, String managerUsername, Long orgId) {
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

        int alreadyReturned = d.returnedQuantity;
        int availableToReturn = d.quantity - alreadyReturned;

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
