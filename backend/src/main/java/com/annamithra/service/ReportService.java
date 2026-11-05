package com.annamithra.service;

import com.annamithra.dto.*;
import com.annamithra.model.*;
import com.annamithra.repository.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private final ItemRepository itemRepo;
    private final PurchaseOrderRepository poRepo;
    private final BranchRequestRepository requestRepo;
    private final DispatchRepository dispatchRepo;
    private final InventoryTransactionRepository transactionRepo;
    private final ItemCategoryRepository categoryRepo;

    public ReportService(ItemRepository itemRepo,
                         PurchaseOrderRepository poRepo,
                         BranchRequestRepository requestRepo,
                         DispatchRepository dispatchRepo,
                         InventoryTransactionRepository transactionRepo,
                         ItemCategoryRepository categoryRepo) {
        this.itemRepo = itemRepo;
        this.poRepo = poRepo;
        this.requestRepo = requestRepo;
        this.dispatchRepo = dispatchRepo;
        this.transactionRepo = transactionRepo;
        this.categoryRepo = categoryRepo;
    }

    public ReportSummaryDto getSummary(LocalDate fromDate, LocalDate toDate, Long orgId) {
        List<PurchaseOrder> pos = (orgId != null)
                ? poRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : poRepo.findAll();
        List<Dispatch> dispatches = (orgId != null)
                ? dispatchRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : dispatchRepo.findAll();

        if (fromDate != null || toDate != null) {
            pos = pos.stream().filter(po -> {
                LocalDate d = po.orderDate != null ? po.orderDate : (po.createdAt != null ? po.createdAt.toLocalDate() : null);
                if (d == null) return false;
                if (fromDate != null && d.isBefore(fromDate)) return false;
                if (toDate != null && d.isAfter(toDate)) return false;
                return true;
            }).toList();

            dispatches = dispatches.stream().filter(d -> {
                LocalDate dt = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                if (dt == null) return false;
                if (fromDate != null && dt.isBefore(fromDate)) return false;
                if (toDate != null && dt.isAfter(toDate)) return false;
                return true;
            }).toList();
        }

        long totalPurchaseOrders = pos.stream()
                .map(po -> po.poNumber != null ? po.poNumber.trim() : ("PO-" + po.id))
                .distinct()
                .count();

        double totalItemsOrdered = pos.stream()
                .mapToDouble(po -> po.quantity)
                .sum();

        double totalQuantityReceived = pos.stream()
                .mapToDouble(po -> po.receivedQty)
                .sum();

        double totalQuantityDispatched = dispatches.stream()
                .mapToDouble(d -> d.quantity)
                .sum();

        double totalPendingAcknowledgement = dispatches.stream()
                .mapToDouble(d -> d.getPendingAcknowledgementQuantity())
                .sum();

        return new ReportSummaryDto(
                totalPurchaseOrders,
                totalItemsOrdered,
                totalQuantityReceived,
                totalQuantityDispatched,
                totalPendingAcknowledgement
        );
    }

    public List<CentralInventoryReportDto> getCentralInventoryReport(String search, Long orgId) {
        return getCentralInventoryReport(null, null, search, orgId);
    }

    public List<CentralInventoryReportDto> getCentralInventoryReport(LocalDate fromDate, LocalDate toDate, String search, Long orgId) {
        List<Item> items = (orgId != null)
                ? itemRepo.findByOrganisationIdOrderByNameAsc(orgId)
                : itemRepo.findAllByOrderByNameAsc();
        List<InventoryTransaction> allTransactions = (orgId != null)
                ? transactionRepo.findByOrganisationIdOrderByTransactionDateDesc(orgId)
                : transactionRepo.findAllByOrderByTransactionDateDesc();

        // Group transactions by item name lowercase
        Map<String, List<InventoryTransaction>> txByItem = allTransactions.stream()
                .collect(Collectors.groupingBy(tx -> tx.itemName.trim().toLowerCase()));

        List<CentralInventoryReportDto> report = new ArrayList<>();
        for (Item item : items) {
            if (search != null && !search.isBlank()) {
                if (!item.name.toLowerCase().contains(search.trim().toLowerCase())) {
                    continue;
                }
            }

            List<InventoryTransaction> txs = txByItem.getOrDefault(item.name.trim().toLowerCase(), Collections.emptyList());

            double totalReceived = txs.stream()
                    .filter(t -> "RECEIPT".equalsIgnoreCase(t.type))
                    .mapToDouble(t -> t.quantity)
                    .sum();

            double totalDispatched = txs.stream()
                    .filter(t -> "DISPATCH".equalsIgnoreCase(t.type))
                    .mapToDouble(t -> t.quantity)
                    .sum();

            CentralInventoryReportDto dto = new CentralInventoryReportDto(
                    item.id,
                    item.name,
                    item.unit,
                    item.stock,
                    totalReceived,
                    totalDispatched
            );

            if (!txs.isEmpty() && txs.get(0).transactionDate != null) {
                dto.lastUpdated = txs.get(0).transactionDate;
            } else if (item.updatedAt != null) {
                dto.lastUpdated = item.updatedAt;
            } else {
                dto.lastUpdated = item.createdAt;
            }

            // Filter by transaction / update date range if provided
            if (fromDate != null || toDate != null) {
                boolean hasActivityInRange = false;
                for (InventoryTransaction t : txs) {
                    if (t.transactionDate != null) {
                        LocalDate td = t.transactionDate.toLocalDate();
                        if ((fromDate == null || !td.isBefore(fromDate)) && (toDate == null || !td.isAfter(toDate))) {
                            hasActivityInRange = true;
                            break;
                        }
                    }
                }
                LocalDate updatedDate = item.updatedAt != null ? item.updatedAt.toLocalDate() : null;
                boolean updatedInRange = updatedDate != null && (fromDate == null || !updatedDate.isBefore(fromDate)) && (toDate == null || !updatedDate.isAfter(toDate));
                LocalDate createdDate = item.createdAt != null ? item.createdAt.toLocalDate() : null;
                boolean createdInRange = createdDate != null && (fromDate == null || !createdDate.isBefore(fromDate)) && (toDate == null || !createdDate.isAfter(toDate));

                if (!hasActivityInRange && !updatedInRange && !createdInRange) {
                    continue;
                }
            }

            for (InventoryTransaction t : txs) {
                dto.activity.add(new InventoryActivityDto(
                        t.id,
                        t.transactionDate,
                        t.type,
                        t.quantity,
                        t.balanceAfter,
                        t.referenceType,
                        t.performedBy
                ));
            }

            report.add(dto);
        }

        return report;
    }

    public List<PurchaseOrderReportDto> getPurchaseOrderReport(LocalDate fromDate, LocalDate toDate, String search, String status, Long orgId) {
        return getPurchaseOrderReport(null, fromDate, toDate, search, status, orgId);
    }

    public List<PurchaseOrderReportDto> getPurchaseOrderReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String search, String status, Long orgId) {
        List<PurchaseOrder> pos = (orgId != null)
                ? poRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : poRepo.findAllByOrderByCreatedAtDesc();

        return pos.stream()
                .filter(po -> {
                    LocalDate orderCreatedDate = po.createdAt != null ? po.createdAt.toLocalDate() : po.orderDate;
                    if (date != null) {
                        if (orderCreatedDate == null || !orderCreatedDate.equals(date)) return false;
                    } else {
                        if (fromDate != null && (orderCreatedDate == null || orderCreatedDate.isBefore(fromDate))) return false;
                        if (toDate != null && (orderCreatedDate == null || orderCreatedDate.isAfter(toDate))) return false;
                    }
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(po.status)) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchItem = po.item != null && po.item.toLowerCase().contains(s);
                        boolean matchPo = po.poNumber != null && po.poNumber.toLowerCase().contains(s);
                        if (!matchItem && !matchPo) return false;
                    }
                    return true;
                })
                .map(po -> new PurchaseOrderReportDto(
                        po.id,
                        po.headerId,
                        po.poNumber != null && !po.poNumber.isBlank() ? po.poNumber : ("PO-" + po.id),
                        po.item,
                        po.unit,
                        po.quantity,
                        po.receivedQty,
                        Math.max(0, po.quantity - po.receivedQty),
                        po.status,
                        po.orderDate,
                        po.createdAt
                ))
                .collect(Collectors.toList());
    }

    public List<InventoryEntryReportDto> getInventoryEntryReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String search, Long orgId) {
        List<InventoryTransaction> transactions = (orgId != null)
                ? transactionRepo.findByOrganisationIdOrderByTransactionDateDesc(orgId)
                : transactionRepo.findAllByOrderByTransactionDateDesc();

        List<Long> refIds = transactions.stream()
                .map(t -> t.referenceId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, String> poNumberCache = new HashMap<>();
        if (!refIds.isEmpty()) {
            for (PurchaseOrder p : poRepo.findAllById(refIds)) {
                if (p.id != null) {
                    poNumberCache.put(p.id, p.poNumber != null && !p.poNumber.isBlank() ? p.poNumber : ("PO-" + p.id));
                }
            }
        }

        return transactions.stream()
                .filter(tx -> "RECEIPT".equalsIgnoreCase(tx.type))
                .filter(tx -> {
                    LocalDate txDate = tx.transactionDate != null ? tx.transactionDate.toLocalDate() : null;
                    if (date != null) {
                        if (txDate == null || !txDate.equals(date)) return false;
                    } else {
                        if (fromDate != null && (txDate == null || txDate.isBefore(fromDate))) return false;
                        if (toDate != null && (txDate == null || txDate.isAfter(toDate))) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchItem = tx.itemName != null && tx.itemName.toLowerCase().contains(s);
                        if (!matchItem) return false;
                    }
                    return true;
                })
                .map(tx -> {
                    String orderNum = "DIRECT_ENTRY";
                    if (tx.referenceId != null) {
                        orderNum = poNumberCache.getOrDefault(tx.referenceId, "PO-" + tx.referenceId);
                    } else if (tx.referenceType != null && !tx.referenceType.isBlank()) {
                        orderNum = tx.referenceType;
                    }

                    return new InventoryEntryReportDto(
                            tx.id,
                            tx.transactionDate,
                            orderNum,
                            tx.itemName,
                            tx.unit,
                            tx.quantity,
                            tx.balanceAfter,
                            tx.performedBy,
                            tx.referenceType
                    );
                })
                .collect(Collectors.toList());
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, Long orgId) {
        return getBranchRequestReport(fromDate, toDate, branch, search, status, null, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, Long orgId) {
        return getBranchRequestReport(fromDate, toDate, branch, search, status, category, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, String department, Long orgId) {
        List<BranchRequest> requests = (orgId != null)
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findAllByOrderByCreatedAtDesc();

        return requests.stream()
                .filter(r -> {
                    LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
                    if (fromDate != null && (rDate == null || rDate.isBefore(fromDate))) return false;
                    if (toDate != null && (rDate == null || rDate.isAfter(toDate))) return false;
                    if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                        if (!branch.equalsIgnoreCase(r.branch)) return false;
                    }
                    String st = r.status != null && !r.status.isBlank() ? r.status : "PENDING";
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(st)) return false;
                    }
                    if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                        if (r.category == null || !r.category.equalsIgnoreCase(category.trim())) return false;
                    }
                    if (department != null && !department.isBlank() && !"ALL".equalsIgnoreCase(department)) {
                        String dept = (r.department != null && !r.department.isBlank()) ? r.department : r.category;
                        if (dept == null || !dept.equalsIgnoreCase(department.trim())) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        if (r.item == null || !r.item.toLowerCase().contains(s)) return false;
                    }
                    return true;
                })
                .map(r -> new BranchRequestReportDto(
                        r.id,
                        r.requestDate,
                        r.createdAt,
                        r.branch,
                        r.itemId,
                        r.item,
                        r.unit,
                        r.category,
                        r.departmentId,
                        (r.department != null && !r.department.isBlank()) ? r.department : r.category,
                        r.requested,
                        r.dispatched,
                        r.received,
                        Math.max(0, r.requested - r.received),
                        r.status != null && !r.status.isBlank() ? r.status : "PENDING"
                    ))
                .collect(Collectors.toList());
    }

    public List<BranchDispatchReportDto> getBranchDispatchReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, Long orgId) {
        return getBranchDispatchReport(null, fromDate, toDate, branch, search, status, null, orgId);
    }

    public List<BranchDispatchReportDto> getBranchDispatchReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String branch, String search, String status, Long orgId) {
        return getBranchDispatchReport(date, fromDate, toDate, branch, search, status, null, orgId);
    }

    public List<BranchDispatchReportDto> getBranchDispatchReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, Long orgId) {
        return getBranchDispatchReport(date, fromDate, toDate, branch, search, status, category, null, orgId);
    }

    public List<BranchDispatchReportDto> getBranchDispatchReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, String department, Long orgId) {
        List<Dispatch> dispatches = (orgId != null)
                ? dispatchRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : dispatchRepo.findAllByOrderByCreatedAtDesc();

        List<Long> reqIds = dispatches.stream()
                .map(d -> d.requestId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Double> requestQtyCache = new HashMap<>();
        Map<Long, String> requestCategoryCache = new HashMap<>();
        Map<Long, String> requestDepartmentCache = new HashMap<>();
        if (!reqIds.isEmpty()) {
            for (BranchRequest r : requestRepo.findAllById(reqIds)) {
                if (r.id != null) {
                    requestQtyCache.put(r.id, r.requested);
                    if (r.category != null) {
                        requestCategoryCache.put(r.id, r.category);
                    }
                    String reqDept = r.getDepartment();
                    if (reqDept != null && !reqDept.isBlank()) {
                        requestDepartmentCache.put(r.id, reqDept.trim());
                    }
                }
            }
        }

        Map<String, String> itemCategoryCache = new HashMap<>();
        List<Item> allItems = (orgId != null) ? itemRepo.findByOrganisationIdOrderByNameAsc(orgId) : itemRepo.findAllByOrderByNameAsc();
        for (Item it : allItems) {
            if (it.name != null && it.category != null) {
                itemCategoryCache.put(it.name.trim().toLowerCase(), it.category);
            }
        }

        return dispatches.stream()
                .filter(d -> {
                    LocalDate dt = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                    if (date != null) {
                        if (dt == null || !dt.equals(date)) return false;
                    } else {
                        if (fromDate != null && (dt == null || dt.isBefore(fromDate))) return false;
                        if (toDate != null && (dt == null || dt.isAfter(toDate))) return false;
                    }
                    if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                        if (!branch.equalsIgnoreCase(d.branchName)) return false;
                    }
                    String st = d.status != null && !d.status.isBlank() ? d.status : "PENDING";
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(st)) return false;
                    }

                    // Department filtering
                    String dept = (d.department != null && !d.department.isBlank())
                            ? d.department.trim()
                            : (d.requestId != null ? requestDepartmentCache.get(d.requestId) : null);
                    if (department != null && !department.isBlank() && !"ALL".equalsIgnoreCase(department)) {
                        if (dept == null || !dept.equalsIgnoreCase(department.trim())) return false;
                    }

                    // Category filtering
                    String cat = (d.requestId != null ? requestCategoryCache.get(d.requestId) : null);
                    if (cat == null && d.itemName != null) {
                        cat = itemCategoryCache.get(d.itemName.trim().toLowerCase());
                    }
                    if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                        if (cat == null || !cat.equalsIgnoreCase(category.trim())) return false;
                    }

                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchItem = d.itemName != null && d.itemName.toLowerCase().contains(s);
                        boolean matchNum = d.dispatchNumber != null && d.dispatchNumber.toLowerCase().contains(s);
                        if (!matchItem && !matchNum) return false;
                    }
                    return true;
                })
                .map(d -> {
                    String st = d.status != null && !d.status.isBlank() ? d.status : "PENDING";
                    boolean isAck = "ACKNOWLEDGED".equalsIgnoreCase(st);
                    double pending = isAck ? 0.0 : Math.max(0.0, d.quantity - d.acknowledgedQuantity);
                    double ackQty = (isAck && d.acknowledgedQuantity == 0 && d.acknowledgementStatus == null && d.shortageQuantity == 0)
                            ? d.quantity
                            : d.acknowledgedQuantity;

                    double reqQty = d.quantity;
                    if (d.isAdditional) {
                        reqQty = 0;
                    } else if (d.requestId != null) {
                        reqQty = requestQtyCache.getOrDefault(d.requestId, d.quantity);
                    }

                    LocalDateTime dtTime = d.createdAt != null ? d.createdAt : (d.dispatchDate != null ? d.dispatchDate.atStartOfDay() : LocalDateTime.now());
                    String dept = (d.department != null && !d.department.isBlank())
                            ? d.department.trim()
                            : (d.requestId != null ? requestDepartmentCache.get(d.requestId) : null);
                    String cat = (d.requestId != null ? requestCategoryCache.get(d.requestId) : null);
                    if (cat == null && d.itemName != null) {
                        cat = itemCategoryCache.get(d.itemName.trim().toLowerCase());
                    }

                    return new BranchDispatchReportDto(
                            d.id,
                            d.dispatchNumber,
                            d.dispatchDate,
                            dtTime,
                            d.branchName,
                            d.itemName,
                            d.unit,
                            cat,
                            dept,
                            reqQty,
                            d.quantity,
                            ackQty,
                            pending,
                            st,
                            d.acknowledgedAt,
                            d.acknowledgedBy,
                            d.shortageQuantity,
                            d.acknowledgementStatus,
                            d.acknowledgementRemarks
                    );
                })
                .collect(Collectors.toList());
    }

    public CategoryWiseReportResponse getCategoryWiseReport(LocalDate date, LocalDate fromDate, LocalDate toDate, String branch, String department, String category, String search, Long orgId) {
        // 1. Preload items mapping: name (lowercase) -> category
        Map<String, String> itemCategoryCache = new HashMap<>();
        List<Item> allItems = (orgId != null) ? itemRepo.findByOrganisationIdOrderByNameAsc(orgId) : itemRepo.findAllByOrderByNameAsc();
        for (Item it : allItems) {
            if (it.name != null && it.category != null && !it.category.isBlank()) {
                itemCategoryCache.put(it.name.trim().toLowerCase(), it.category.trim());
            }
        }

        // 2. Fetch branch requests
        List<BranchRequest> requests = (orgId != null)
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findAllByOrderByCreatedAtDesc();

        // 3. Preload latest dispatch dates for these requests
        List<Long> reqIds = requests.stream().map(r -> r.id).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, LocalDate> latestDispatchDateMap = new HashMap<>();
        Map<Long, LocalDateTime> latestDispatchDateTimeMap = new HashMap<>();
        if (!reqIds.isEmpty()) {
            List<Dispatch> dispatches = (orgId != null)
                    ? dispatchRepo.findByOrganisationIdAndRequestIdIn(orgId, reqIds)
                    : dispatchRepo.findByRequestIdIn(reqIds);
            for (Dispatch d : dispatches) {
                if (d.requestId != null) {
                    LocalDate dDate = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                    LocalDateTime dDateTime = d.createdAt != null ? d.createdAt : (d.dispatchDate != null ? d.dispatchDate.atStartOfDay() : null);
                    if (dDate != null && (!latestDispatchDateMap.containsKey(d.requestId) || dDate.isAfter(latestDispatchDateMap.get(d.requestId)))) {
                        latestDispatchDateMap.put(d.requestId, dDate);
                        latestDispatchDateTimeMap.put(d.requestId, dDateTime);
                    }
                }
            }
        }

        // 4. Filter requests by Date, Branch, Department, Category, and Search
        List<CategoryWiseReportItemDto> filteredItems = new ArrayList<>();
        for (BranchRequest r : requests) {
            LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
            if (date != null) {
                if (rDate == null || !rDate.equals(date)) continue;
            } else {
                if (fromDate != null && (rDate == null || rDate.isBefore(fromDate))) continue;
                if (toDate != null && (rDate == null || rDate.isAfter(toDate))) continue;
            }

            if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                if (!branch.equalsIgnoreCase(r.branch)) continue;
            }

            String reqDept = (r.department != null && !r.department.isBlank()) ? r.department.trim() : (r.category != null ? r.category.trim() : "Not specified");
            if (department != null && !department.isBlank() && !"ALL".equalsIgnoreCase(department)) {
                if (!department.equalsIgnoreCase(reqDept)) continue;
            }

            String itemCat = itemCategoryCache.getOrDefault(r.item != null ? r.item.trim().toLowerCase() : "", "Uncategorised");
            if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                if (!category.equalsIgnoreCase(itemCat)) continue;
            }

            if (search != null && !search.isBlank()) {
                String s = search.trim().toLowerCase();
                boolean matchItem = r.item != null && r.item.toLowerCase().contains(s);
                boolean matchBranch = r.branch != null && r.branch.toLowerCase().contains(s);
                boolean matchDept = reqDept.toLowerCase().contains(s);
                boolean matchCat = itemCat.toLowerCase().contains(s);
                if (!matchItem && !matchBranch && !matchDept && !matchCat) continue;
            }

            double requestedQty = r.requested;
            double dispatchedQty = r.dispatched;
            double pendingQty = Math.max(0, requestedQty - dispatchedQty);

            String dispatchStatus;
            if (dispatchedQty >= requestedQty && requestedQty > 0) {
                dispatchStatus = "Dispatched";
            } else if (dispatchedQty > 0) {
                dispatchStatus = "Partially Dispatched";
            } else {
                dispatchStatus = "Pending";
            }

            LocalDate dispDate = latestDispatchDateMap.get(r.id);
            LocalDateTime dispDateTime = latestDispatchDateTimeMap.get(r.id);

            filteredItems.add(new CategoryWiseReportItemDto(
                    r.id,
                    r.item,
                    itemCat,
                    r.unit,
                    r.branch,
                    reqDept,
                    requestedQty,
                    dispatchedQty,
                    pendingQty,
                    rDate,
                    dispDate,
                    dispDateTime,
                    dispatchStatus,
                    r.status
            ));
        }

        // Sort items by requestDate desc, then branch, then itemName
        filteredItems.sort((a, b) -> {
            if (a.requestDate != null && b.requestDate != null && !b.requestDate.equals(a.requestDate)) {
                return b.requestDate.compareTo(a.requestDate);
            }
            if (a.branchName != null && b.branchName != null && !a.branchName.equals(b.branchName)) {
                return a.branchName.compareTo(b.branchName);
            }
            return (a.itemName != null ? a.itemName : "").compareTo(b.itemName != null ? b.itemName : "");
        });

        // 5. Build Category Summary
        Map<String, List<CategoryWiseReportItemDto>> itemsByCategory = filteredItems.stream()
                .collect(Collectors.groupingBy(it -> it.category));

        Set<String> allCategoryNames = new LinkedHashSet<>();
        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            allCategoryNames.add(category.trim());
        } else {
            List<ItemCategory> masterCats = (orgId != null)
                    ? categoryRepo.findByOrganisationIdAndActiveTrueOrderByNameAsc(orgId)
                    : categoryRepo.findAllByActiveTrueOrderByNameAsc();
            for (ItemCategory mc : masterCats) {
                if (mc.name != null && !mc.name.isBlank()) {
                    allCategoryNames.add(mc.name.trim());
                }
            }
            itemsByCategory.keySet().forEach(allCategoryNames::add);
        }

        List<CategorySummaryDto> summaryList = new ArrayList<>();
        for (String catName : allCategoryNames) {
            List<CategoryWiseReportItemDto> catItems = itemsByCategory.getOrDefault(catName, Collections.emptyList());

            int distinctItems = (int) catItems.stream()
                    .map(it -> it.itemName != null ? it.itemName.toLowerCase().trim() : "")
                    .filter(s -> !s.isEmpty())
                    .distinct()
                    .count();

            Map<String, Double> reqByUnit = new TreeMap<>();
            Map<String, Double> dispByUnit = new TreeMap<>();
            Map<String, Double> pendByUnit = new TreeMap<>();

            for (CategoryWiseReportItemDto it : catItems) {
                String u = it.unit != null ? it.unit.toUpperCase().trim() : "KG";
                reqByUnit.put(u, reqByUnit.getOrDefault(u, 0.0) + it.requestedQuantity);
                dispByUnit.put(u, dispByUnit.getOrDefault(u, 0.0) + it.dispatchedQuantity);
                pendByUnit.put(u, pendByUnit.getOrDefault(u, 0.0) + it.pendingQuantity);
            }

            summaryList.add(new CategorySummaryDto(catName, distinctItems, reqByUnit, dispByUnit, pendByUnit));
        }

        summaryList.sort((a, b) -> {
            boolean aHas = a.totalItems > 0;
            boolean bHas = b.totalItems > 0;
            if (aHas != bHas) return aHas ? -1 : 1;
            return a.category.compareToIgnoreCase(b.category);
        });

        return new CategoryWiseReportResponse(summaryList, filteredItems);
    }
}