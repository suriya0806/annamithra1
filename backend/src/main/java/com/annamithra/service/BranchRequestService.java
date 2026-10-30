package com.annamithra.service;

import com.annamithra.dto.AggregatedBranchRequestDto;
import com.annamithra.dto.BranchRequestDateSectionDto;
import com.annamithra.dto.BranchRequestHistoryDto;
import com.annamithra.dto.ConsolidatedItemDto;
import com.annamithra.dto.MultiItemBranchRequest;
import com.annamithra.model.BranchRequest;
import com.annamithra.model.Dispatch;
import com.annamithra.model.Item;
import com.annamithra.repository.BranchRequestRepository;
import com.annamithra.repository.DispatchRepository;
import com.annamithra.repository.ItemRepository;
import com.annamithra.repository.PurchaseOrderRepository;
import com.annamithra.model.PurchaseOrder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class BranchRequestService {
    private final BranchRequestRepository requestRepo;
    private final ItemRepository itemRepo;
    private final DispatchRepository dispatchRepo;
    private final PurchaseOrderRepository orderRepo;
    private final DepartmentService departmentService;

    public static final List<String> ALLOWED_CATEGORIES = List.of(
        "General",
        "Front Office",
        "Kitchen",
        "Tea/Coffee",
        "Vada Stall",
        "Sweet/Savouries",
        "Bakery",
        "Parcel",
        "Dishwasher",
        "Dining Hall",
        "Vegetables",
        "Groceries",
        "Dosa Kal",
        "Chinese",
        "Idly"
    );

    public BranchRequestService(BranchRequestRepository requestRepo, ItemRepository itemRepo,
                                DispatchRepository dispatchRepo, PurchaseOrderRepository orderRepo,
                                DepartmentService departmentService) {
        this.requestRepo = requestRepo;
        this.itemRepo = itemRepo;
        this.dispatchRepo = dispatchRepo;
        this.orderRepo = orderRepo;
        this.departmentService = departmentService;
    }

    @Transactional
    public List<BranchRequest> submitBranchRequest(MultiItemBranchRequest req, String branchName, Long branchId, Long orgId) {
        if (req == null || req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order request must contain at least one item");
        }
        if (branchName == null || branchName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Branch name is required");
        }

        String batchId = "REQ-" + System.currentTimeMillis();
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        List<BranchRequest> created = new ArrayList<>();

        for (MultiItemBranchRequest.ItemLine line : req.items) {
            if (line.itemName == null || line.itemName.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name cannot be blank");
            }
            if (line.unit == null || line.unit.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit cannot be blank for " + line.itemName);
            }
            if (line.requestedQuantity <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Requested quantity must be positive for " + line.itemName);
            }
            String effectiveDept = line.getEffectiveDepartment();
            if (effectiveDept == null || effectiveDept.isBlank()) {
                effectiveDept = req.getEffectiveDepartment();
            }
            if (effectiveDept == null || effectiveDept.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Department is required to place an order");
            }

            String trimmedDept = effectiveDept.trim();
            String matchedDept = null;
            if (departmentService != null && departmentService.isValidDepartment(orgId, trimmedDept)) {
                matchedDept = departmentService.getDepartments(orgId).stream()
                    .filter(d -> d.name.equalsIgnoreCase(trimmedDept))
                    .map(d -> d.name)
                    .findFirst()
                    .orElse(trimmedDept);
            } else {
                matchedDept = ALLOWED_CATEGORIES.stream()
                    .filter(c -> c.equalsIgnoreCase(trimmedDept))
                    .findFirst()
                    .orElse(null);
            }

            if (matchedDept == null) {
                if (trimmedDept.equalsIgnoreCase("Misc") || trimmedDept.equalsIgnoreCase("Other") || trimmedDept.equalsIgnoreCase("Others")) {
                    matchedDept = "General";
                } else {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid department '" + effectiveDept + "'. Please select a valid department.");
                }
            }

            String itemName = line.itemName.trim();
            String unit = line.unit.trim().toUpperCase();

            // Ensure item is in catalogue for this organisation
            Optional<Item> existing = (orgId != null)
                ? itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, itemName)
                : itemRepo.findByNameIgnoreCase(itemName);
            if (existing.isEmpty()) {
                Item newItem = new Item(itemName, unit, 0);
                newItem.organisationId = orgId;
                itemRepo.save(newItem);
            }

            BranchRequest br = new BranchRequest();
            br.batchId = batchId;
            br.branch = branchName.trim();
            br.branchId = branchId;
            br.item = itemName;
            br.unit = unit;
            br.category = matchedDept;
            br.department = matchedDept;
            br.requested = line.requestedQuantity;
            br.dispatched = 0;
            br.received = 0;
            br.status = "PENDING";
            br.requestDate = today;
            br.createdAt = now;
            br.organisationId = orgId;

            created.add(requestRepo.save(br));
        }

        return created;
    }

    public List<BranchRequest> getRequestsByBranch(String branchName, LocalDate date, LocalDate fromDate, LocalDate toDate, Long orgId) {
        return getRequestsByBranch(branchName, date, fromDate, toDate, null, orgId);
    }

    public List<BranchRequest> getRequestsByBranch(String branchName, LocalDate date, LocalDate fromDate, LocalDate toDate, String category, Long orgId) {
        List<BranchRequest> all;
        if (orgId != null) {
            all = (branchName == null || branchName.isBlank())
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findByOrganisationIdAndBranchOrderByCreatedAtDesc(orgId, branchName.trim());
        } else {
            all = (branchName == null || branchName.isBlank())
                ? requestRepo.findAllByOrderByCreatedAtDesc()
                : requestRepo.findByBranchOrderByCreatedAtDesc(branchName.trim());
        }

        return all.stream()
            .filter(r -> {
                LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
                if (date != null) {
                    if (rDate == null || !rDate.equals(date)) return false;
                }
                if (fromDate != null && (rDate == null || rDate.isBefore(fromDate))) {
                    return false;
                }
                if (toDate != null && (rDate == null || rDate.isAfter(toDate))) {
                    return false;
                }
                if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                    if (r.category == null || !r.category.equalsIgnoreCase(category.trim())) {
                        return false;
                    }
                }
                return true;
            })
            .toList();
    }

    public List<BranchRequest> getOutstandingRequestsForBranch(String branchName, LocalDate date, Long orgId) {
        List<BranchRequest> all;
        if (branchName != null && !branchName.isBlank()) {
            all = (orgId != null)
                ? requestRepo.findOutstandingForOrganisationAndBranch(orgId, branchName.trim())
                : requestRepo.findOutstandingForBranch(branchName.trim());
        } else {
            all = (orgId != null)
                ? requestRepo.findAllOutstandingByOrganisationId(orgId)
                : requestRepo.findAllOutstanding();
        }

        if (date == null) {
            return all;
        }
        return all.stream()
            .filter(r -> {
                LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
                return rDate != null && rDate.equals(date);
            })
            .toList();
    }

    public List<ConsolidatedItemDto> getConsolidatedRequirements(LocalDate filterDate, Long orgId) {
        List<BranchRequest> outstanding = (orgId != null)
            ? requestRepo.findAllOutstandingByOrganisationId(orgId)
            : requestRepo.findAllOutstanding();

        Map<String, Double> branchReqTotals = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        Map<String, String> itemUnits = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        Map<String, String> displayNames = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

        // 1. Gather all unfulfilled branch requirements
        for (BranchRequest r : outstanding) {
            LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
            if (filterDate != null && (rDate == null || !rDate.equals(filterDate))) {
                continue;
            }
            double remaining = r.getRemainingToDispatch();
            if (remaining > 0) {
                String name = r.item.trim();
                branchReqTotals.put(name, branchReqTotals.getOrDefault(name, 0.0) + remaining);
                itemUnits.putIfAbsent(name, r.unit != null ? r.unit.trim().toUpperCase() : "KG");
                displayNames.putIfAbsent(name, r.item.trim());
            }
        }

        // 2. Gather quantities already allocated to successfully submitted purchase orders for this org
        List<PurchaseOrder> submittedOrders = (orgId != null)
            ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : orderRepo.findAll();

        Map<String, Double> allocatedPoTotals = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);

        for (PurchaseOrder po : submittedOrders) {
            if (po.item == null || po.quantity <= 0) continue;
            if (!"STORE_MANAGER".equalsIgnoreCase(po.source) && (po.poNumber == null || !po.poNumber.toUpperCase().startsWith("ORDER"))) {
                continue;
            }
            if ("CANCELLED".equalsIgnoreCase(po.status) || "FAILED".equalsIgnoreCase(po.status)) {
                continue;
            }

            LocalDate poReqDate = po.requestDate != null ? po.requestDate : po.orderDate;
            if (filterDate != null && (poReqDate == null || !poReqDate.equals(filterDate))) {
                continue;
            }

            String name = po.item.trim();
            allocatedPoTotals.put(name, allocatedPoTotals.getOrDefault(name, 0.0) + po.quantity);
        }

        // 3. Outstanding Requirement = Total Branch Requirement - Quantity Already Allocated
        List<ConsolidatedItemDto> result = new ArrayList<>();
        for (Map.Entry<String, Double> entry : branchReqTotals.entrySet()) {
            String key = entry.getKey();
            double totalReq = entry.getValue();
            double allocated = allocatedPoTotals.getOrDefault(key, 0.0);
            double outstandingReq = Math.max(0.0, totalReq - allocated);

            if (outstandingReq > 0) {
                String displayName = displayNames.getOrDefault(key, key);
                Item it = (orgId != null)
                    ? itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, key).orElse(null)
                    : itemRepo.findByNameIgnoreCase(key).orElse(null);

                double stock = (it != null) ? it.stock : 0.0;
                String unit = (it != null && it.unit != null && !it.unit.isBlank()) ? it.unit : itemUnits.getOrDefault(key, "KG");
                result.add(new ConsolidatedItemDto(displayName, unit, outstandingReq, stock, totalReq, allocated));
            }
        }

        return result;
    }

    public List<BranchRequestDateSectionDto> getDateWiseAggregatedRequests(String branchName, LocalDate filterDate, Long orgId) {
        List<BranchRequest> requests;
        if (orgId != null) {
            requests = (branchName == null || branchName.isBlank())
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findByOrganisationIdAndBranchOrderByCreatedAtDesc(orgId, branchName.trim());
        } else {
            requests = (branchName == null || branchName.isBlank())
                ? requestRepo.findAllByOrderByCreatedAtDesc()
                : requestRepo.findByBranchOrderByCreatedAtDesc(branchName.trim());
        }

        if (requests.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> requestIds = requests.stream()
            .map(r -> r.id)
            .filter(Objects::nonNull)
            .toList();

        Map<Long, List<Dispatch>> dispatchesByRequestId = new HashMap<>();
        if (!requestIds.isEmpty()) {
            List<Dispatch> dispatches = (orgId != null)
                ? dispatchRepo.findByOrganisationIdAndRequestIdIn(orgId, requestIds)
                : dispatchRepo.findByRequestIdIn(requestIds);

            for (Dispatch d : dispatches) {
                if (d.requestId != null) {
                    dispatchesByRequestId.computeIfAbsent(d.requestId, k -> new ArrayList<>()).add(d);
                }
            }
        }

        // Group by Date (newest date first using reverse-order TreeMap)
        Map<LocalDate, Map<String, List<BranchRequest>>> dateItemMap = new TreeMap<>(Comparator.reverseOrder());

        for (BranchRequest r : requests) {
            LocalDate date = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : LocalDate.now());
            if (filterDate != null && !date.equals(filterDate)) {
                continue;
            }
            String itemKey = r.item.trim().toLowerCase() + "||" + r.unit.trim().toUpperCase();
            dateItemMap.computeIfAbsent(date, d -> new LinkedHashMap<>())
                       .computeIfAbsent(itemKey, k -> new ArrayList<>())
                       .add(r);
        }

        List<BranchRequestDateSectionDto> sections = new ArrayList<>();
        DateTimeFormatter sectionDateFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH);
        DateTimeFormatter displayDateFmt = DateTimeFormatter.ofPattern("dd-MM-yyyy");
        DateTimeFormatter timeFmt = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

        for (Map.Entry<LocalDate, Map<String, List<BranchRequest>>> dateEntry : dateItemMap.entrySet()) {
            LocalDate sectionDate = dateEntry.getKey();
            String formattedSectionDate = sectionDate.format(sectionDateFmt);

            List<AggregatedBranchRequestDto> sectionItems = new ArrayList<>();

            for (Map.Entry<String, List<BranchRequest>> itemEntry : dateEntry.getValue().entrySet()) {
                List<BranchRequest> group = itemEntry.getValue();
                if (group.isEmpty()) continue;

                String displayItem = group.get(0).item;
                String displayUnit = group.get(0).unit.trim().toUpperCase();
                String branch = group.get(0).branch;

                double totalRequested = 0.0;
                double alreadyDispatched = 0.0;
                double confirmedReceived = 0.0;

                List<BranchRequestHistoryDto> historyList = new ArrayList<>();

                for (BranchRequest br : group) {
                    totalRequested += br.requested;

                    List<Dispatch> reqDispatches = dispatchesByRequestId.getOrDefault(br.id, Collections.emptyList());
                    double dispatchSum = reqDispatches.stream().mapToDouble(d -> d.quantity).sum();
                    double receivedSum = reqDispatches.stream()
                        .filter(d -> "ACKNOWLEDGED".equalsIgnoreCase(d.status))
                        .mapToDouble(d -> d.acknowledgedQuantity > 0 ? d.acknowledgedQuantity : d.quantity)
                        .sum();

                    double actualDispatched = Math.max(br.dispatched, dispatchSum);
                    double actualReceived = Math.max(br.received, receivedSum);

                    alreadyDispatched += actualDispatched;
                    confirmedReceived += actualReceived;

                    String timeStr = "Time Unavailable";
                    if (br.createdAt != null) {
                        timeStr = br.createdAt.format(timeFmt);
                    }

                    String formattedReqDate = (br.requestDate != null)
                        ? br.requestDate.format(displayDateFmt)
                        : (br.createdAt != null ? br.createdAt.format(displayDateFmt) : "N/A");

                    historyList.add(new BranchRequestHistoryDto(
                        br.id,
                        br.requestDate,
                        formattedReqDate,
                        timeStr,
                        br.createdAt,
                        br.item,
                        br.unit,
                        br.category,
                        br.requested,
                        actualDispatched,
                        actualReceived,
                        br.status
                    ));
                }

                // Sort individual history records newest first
                historyList.sort((a, b) -> {
                    if (a.createdAt != null && b.createdAt != null) {
                        return b.createdAt.compareTo(a.createdAt);
                    } else if (a.createdAt != null) {
                        return -1;
                    } else if (b.createdAt != null) {
                        return 1;
                    } else {
                        return Long.compare(b.id != null ? b.id : 0, a.id != null ? a.id : 0);
                    }
                });

                double remainingToDispatch = Math.max(0.0, totalRequested - alreadyDispatched);

                // Delivery status calculation
                String deliveryStatus;
                String deliveryStatusLabel;
                if (totalRequested > 0 && confirmedReceived >= totalRequested) {
                    deliveryStatus = "COMPLETED";
                    deliveryStatusLabel = "Delivered / Completed";
                } else if (confirmedReceived > 0) {
                    deliveryStatus = "PARTIALLY_DELIVERED";
                    deliveryStatusLabel = "Partially Delivered";
                } else if (alreadyDispatched > 0) {
                    deliveryStatus = "PENDING";
                    deliveryStatusLabel = "Pending Acknowledgement";
                } else {
                    deliveryStatus = "PENDING";
                    deliveryStatusLabel = "Pending";
                }

                AggregatedBranchRequestDto dto = new AggregatedBranchRequestDto(
                    branch,
                    sectionDate,
                    sectionDate.format(displayDateFmt),
                    displayItem,
                    displayUnit,
                    group.get(0).category,
                    totalRequested,
                    alreadyDispatched,
                    confirmedReceived,
                    remainingToDispatch,
                    deliveryStatus,
                    deliveryStatusLabel,
                    historyList
                );

                sectionItems.add(dto);
            }

            // Sort items alphabetically by Item Name
            sectionItems.sort((a, b) -> a.item.compareToIgnoreCase(b.item));

            sections.add(new BranchRequestDateSectionDto(sectionDate, formattedSectionDate, sectionItems));
        }

        return sections;
    }

    public List<BranchRequestHistoryDto> getRequestHistory(String branch, LocalDate date, String item, String unit, Long orgId) {
        List<BranchRequestDateSectionDto> sections = getDateWiseAggregatedRequests(branch, date, orgId);
        for (BranchRequestDateSectionDto section : sections) {
            if (section.requestDate.equals(date)) {
                for (AggregatedBranchRequestDto agg : section.items) {
                    if (agg.item.equalsIgnoreCase(item.trim()) && (unit == null || unit.isBlank() || agg.unit.equalsIgnoreCase(unit.trim()))) {
                        return agg.history;
                    }
                }
            }
        }
        return Collections.emptyList();
    }
}
