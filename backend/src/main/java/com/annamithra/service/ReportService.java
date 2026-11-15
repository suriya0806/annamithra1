package com.annamithra.service;

import com.annamithra.dto.*;
import com.annamithra.model.*;
import com.annamithra.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
    private final DepartmentRepository departmentRepo;

    public ReportService(ItemRepository itemRepo,
                         PurchaseOrderRepository poRepo,
                         BranchRequestRepository requestRepo,
                         DispatchRepository dispatchRepo,
                         InventoryTransactionRepository transactionRepo,
                         ItemCategoryRepository categoryRepo,
                         DepartmentRepository departmentRepo) {
        this.itemRepo = itemRepo;
        this.poRepo = poRepo;
        this.requestRepo = requestRepo;
        this.dispatchRepo = dispatchRepo;
        this.transactionRepo = transactionRepo;
        this.categoryRepo = categoryRepo;
        this.departmentRepo = departmentRepo;
    }

    private Map<Long, String> buildDepartmentCache(Long orgId) {
        Map<Long, String> map = new HashMap<>();
        if (departmentRepo != null) {
            List<Department> list = (orgId != null)
                    ? departmentRepo.findByOrganisationIdOrderByNameAsc(orgId)
                    : departmentRepo.findAllByOrderByNameAsc();
            for (Department d : list) {
                if (d.id != null && d.name != null && !d.name.isBlank()) {
                    map.put(d.id, d.name.trim());
                }
            }
        }
        return map;
    }

    private String resolveDepartmentName(String deptName, Long deptId, String fallbackCategory, Map<Long, String> deptCache) {
        if (deptName != null && !deptName.isBlank()
                && !"null".equalsIgnoreCase(deptName.trim())
                && !"Not specified".equalsIgnoreCase(deptName.trim())
                && !"Unassigned".equalsIgnoreCase(deptName.trim())) {
            return deptName.trim();
        }
        if (deptId != null && deptCache != null) {
            String fromCache = deptCache.get(deptId);
            if (fromCache != null && !fromCache.isBlank()) {
                return fromCache.trim();
            }
        }
        if (fallbackCategory != null && !fallbackCategory.isBlank()
                && !"null".equalsIgnoreCase(fallbackCategory.trim())
                && !"Not specified".equalsIgnoreCase(fallbackCategory.trim())
                && !"Unassigned".equalsIgnoreCase(fallbackCategory.trim())) {
            return fallbackCategory.trim();
        }
        return "Unassigned";
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
        return getBranchRequestReport(fromDate, toDate, branch, search, status, null, null, null, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, Long orgId) {
        return getBranchRequestReport(fromDate, toDate, branch, search, status, category, null, null, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, String department, Long orgId) {
        return getBranchRequestReport(fromDate, toDate, branch, search, status, category, department, null, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, String department, String view, Boolean departmentBreakdown, Long orgId) {
        List<BranchRequest> requests = (orgId != null)
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findAllByOrderByCreatedAtDesc();

        Map<Long, String> deptCache = buildDepartmentCache(orgId);

        List<BranchRequest> filtered = requests.stream()
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
                        String dept = resolveDepartmentName(r.department, r.departmentId, r.category, deptCache);
                        if (dept == null || !dept.equalsIgnoreCase(department.trim())) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        if (r.item == null || !r.item.toLowerCase().contains(s)) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        boolean isDepartment = "department".equalsIgnoreCase(view) || Boolean.TRUE.equals(departmentBreakdown);
        boolean isConsolidated = "consolidated".equalsIgnoreCase(view) || (Boolean.FALSE.equals(departmentBreakdown) && !"department".equalsIgnoreCase(view));

        if (isConsolidated && !isDepartment) {
            // Group by Item ID and Unit across all dates and departments
            Map<String, BranchRequestAggregator> groupMap = new LinkedHashMap<>();
            for (BranchRequest r : filtered) {
                String itemKey = r.itemId != null ? String.valueOf(r.itemId) : (r.item != null ? r.item.trim().toLowerCase() : "");
                String unitKey = r.unit != null ? r.unit.trim().toUpperCase() : "";
                String key = itemKey + "___" + unitKey;

                BranchRequestAggregator agg = groupMap.computeIfAbsent(key, k -> new BranchRequestAggregator(
                        r.itemId,
                        r.item,
                        unitKey,
                        null,
                        null
                ));
                agg.accumulate(r.requested, r.dispatched, r.received);
            }

            return groupMap.values().stream()
                    .map(BranchRequestAggregator::toConsolidatedDto)
                    .sorted(Comparator.comparing(dto -> dto.itemName != null ? dto.itemName.toLowerCase() : ""))
                    .collect(Collectors.toList());

        } else if (isDepartment) {
            // Group by Department ID, Item ID, and Unit across all dates within department
            Map<String, BranchRequestAggregator> groupMap = new LinkedHashMap<>();
            for (BranchRequest r : filtered) {
                String deptName = resolveDepartmentName(r.department, r.departmentId, r.category, deptCache);
                Long deptId = r.departmentId;
                String itemKey = r.itemId != null ? String.valueOf(r.itemId) : (r.item != null ? r.item.trim().toLowerCase() : "");
                String unitKey = r.unit != null ? r.unit.trim().toUpperCase() : "";
                String key = (deptId != null ? String.valueOf(deptId) : deptName.toLowerCase()) + "___" + itemKey + "___" + unitKey;

                BranchRequestAggregator agg = groupMap.computeIfAbsent(key, k -> new BranchRequestAggregator(
                        r.itemId,
                        r.item,
                        unitKey,
                        deptId,
                        deptName
                ));
                agg.accumulate(r.requested, r.dispatched, r.received);
            }

            return groupMap.values().stream()
                    .map(BranchRequestAggregator::toDepartmentDto)
                    .sorted(Comparator.comparing((BranchRequestReportDto dto) -> dto.department != null ? dto.department.toLowerCase() : "")
                            .thenComparing(dto -> dto.itemName != null ? dto.itemName.toLowerCase() : ""))
                    .collect(Collectors.toList());
        }

        return filtered.stream()
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
                        resolveDepartmentName(r.department, r.departmentId, r.category, deptCache),
                        r.requested,
                        r.dispatched,
                        r.received,
                        Math.max(0, r.requested - r.received),
                        r.status != null && !r.status.isBlank() ? r.status : "PENDING"
                ))
                .collect(Collectors.toList());
    }

    private static class BranchRequestAggregator {
        final Long itemId;
        final String itemName;
        final String unit;
        final Long departmentId;
        final String department;
        BigDecimal requestedSum = BigDecimal.ZERO;
        BigDecimal dispatchedSum = BigDecimal.ZERO;
        BigDecimal receivedSum = BigDecimal.ZERO;

        BranchRequestAggregator(Long itemId, String itemName, String unit, Long departmentId, String department) {
            this.itemId = itemId;
            this.itemName = itemName;
            this.unit = unit;
            this.departmentId = departmentId;
            this.department = department;
        }

        void accumulate(double req, double disp, double rec) {
            requestedSum = requestedSum.add(BigDecimal.valueOf(req));
            dispatchedSum = dispatchedSum.add(BigDecimal.valueOf(disp));
            receivedSum = receivedSum.add(BigDecimal.valueOf(rec));
        }

        BranchRequestReportDto toConsolidatedDto() {
            BranchRequestReportDto dto = new BranchRequestReportDto();
            dto.itemId = this.itemId;
            dto.itemName = this.itemName;
            dto.unit = this.unit;
            dto.departmentId = null;
            dto.department = null;
            dto.category = null;
            dto.requestedQuantity = requestedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.dispatchedQuantity = dispatchedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.acknowledgedReceivedQuantity = receivedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.remainingQuantity = Math.max(0, dto.requestedQuantity - dto.acknowledgedReceivedQuantity);
            dto.status = "CONSOLIDATED";
            return dto;
        }

        BranchRequestReportDto toDepartmentDto() {
            BranchRequestReportDto dto = new BranchRequestReportDto();
            dto.itemId = this.itemId;
            dto.itemName = this.itemName;
            dto.unit = this.unit;
            dto.departmentId = this.departmentId;
            dto.department = this.department;
            dto.category = this.department;
            dto.requestedQuantity = requestedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.dispatchedQuantity = dispatchedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.acknowledgedReceivedQuantity = receivedSum.setScale(3, RoundingMode.HALF_UP).doubleValue();
            dto.remainingQuantity = Math.max(0, dto.requestedQuantity - dto.acknowledgedReceivedQuantity);
            dto.status = "DEPARTMENT_BREAKDOWN";
            return dto;
        }
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

        Map<Long, String> deptCache = buildDepartmentCache(orgId);

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
                    String rawDept = (d.department != null && !d.department.isBlank())
                            ? d.department.trim()
                            : (d.requestId != null ? requestDepartmentCache.get(d.requestId) : null);
                    String dept = resolveDepartmentName(rawDept, d.departmentId, null, deptCache);
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
                    String rawDept = (d.department != null && !d.department.isBlank())
                            ? d.department.trim()
                            : (d.requestId != null ? requestDepartmentCache.get(d.requestId) : null);
                    String dept = resolveDepartmentName(rawDept, d.departmentId, null, deptCache);
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
        Map<Long, String> deptCache = buildDepartmentCache(orgId);
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

            String reqDept = resolveDepartmentName(r.department, r.departmentId, r.category, deptCache);
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

    // -------------------------------------------------------------
    // COMMON CONSOLIDATED BRANCH REPORTS (SUMMARY & DETAILS VIEW)
    // -------------------------------------------------------------

    public BranchConsolidatedReportDto getConsolidatedBranchRequestReport(
            LocalDate fromDate, LocalDate toDate, String branch, String department, String search, String status, Long orgId) {
        return getConsolidatedBranchRequestReport(fromDate, toDate, branch, department, search, status, false, orgId);
    }

    public BranchConsolidatedReportDto getConsolidatedBranchRequestReport(
            LocalDate fromDate, LocalDate toDate, String branch, String department, String search, String status, Boolean departmentBreakdown, Long orgId) {
        List<BranchRequest> requests = (orgId != null)
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findAllByOrderByCreatedAtDesc();

        LocalDate effectiveFrom = fromDate;
        LocalDate effectiveTo = toDate;
        if (effectiveFrom == null && effectiveTo == null) {
            effectiveFrom = LocalDate.now();
            effectiveTo = LocalDate.now();
        } else if (effectiveFrom != null && effectiveTo == null) {
            effectiveTo = effectiveFrom;
        }

        LocalDate finalFrom = effectiveFrom;
        LocalDate finalTo = effectiveTo;

        Map<Long, String> deptCache = buildDepartmentCache(orgId);

        List<BranchRequest> filtered = requests.stream()
                .filter(r -> {
                    LocalDate rDate = r.requestDate != null ? r.requestDate : (r.createdAt != null ? r.createdAt.toLocalDate() : null);
                    if (finalFrom != null && (rDate == null || rDate.isBefore(finalFrom))) return false;
                    if (finalTo != null && (rDate == null || rDate.isAfter(finalTo))) return false;
                    if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                        if (!branch.equalsIgnoreCase(r.branch)) return false;
                    }
                    String st = r.status != null && !r.status.isBlank() ? r.status : "PENDING";
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(st)) return false;
                    }
                    if (department != null && !department.isBlank() && !"ALL".equalsIgnoreCase(department)) {
                        String dept = resolveDepartmentName(r.department, r.departmentId, r.category, deptCache);
                        if (dept == null || !dept.equalsIgnoreCase(department.trim())) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchItem = r.item != null && r.item.toLowerCase().contains(s);
                        boolean matchBranch = r.branch != null && r.branch.toLowerCase().contains(s);
                        if (!matchItem && !matchBranch) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Map<String, List<BranchRequest>> byBranch = new LinkedHashMap<>();
        Map<String, String> branchKeyToName = new HashMap<>();
        Map<String, Long> branchKeyToId = new HashMap<>();

        for (BranchRequest r : filtered) {
            String bName = (r.branch != null && !r.branch.isBlank()) ? r.branch.trim() : "Unknown Branch";
            String key = (r.branchId != null && r.branchId > 0) ? ("ID_" + r.branchId) : ("NAME_" + bName.toLowerCase());
            byBranch.computeIfAbsent(key, k -> new ArrayList<>()).add(r);
            branchKeyToName.putIfAbsent(key, bName);
            if (r.branchId != null) branchKeyToId.putIfAbsent(key, r.branchId);
        }

        // Preload latest dispatches for the requests to get delivery date and acknowledgement status
        List<Long> reqIds = filtered.stream().map(r -> r.id).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, LocalDate> latestDispatchDateMap = new HashMap<>();
        Map<Long, String> latestAckStatusMap = new HashMap<>();
        if (!reqIds.isEmpty()) {
            List<Dispatch> dispatches = (orgId != null)
                    ? dispatchRepo.findByOrganisationIdAndRequestIdIn(orgId, reqIds)
                    : dispatchRepo.findByRequestIdIn(reqIds);
            for (Dispatch d : dispatches) {
                if (d.requestId != null) {
                    LocalDate dDate = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                    if (dDate != null && (!latestDispatchDateMap.containsKey(d.requestId) || dDate.isAfter(latestDispatchDateMap.get(d.requestId)))) {
                        latestDispatchDateMap.put(d.requestId, dDate);
                        String ackSt = (d.acknowledgementStatus != null && !d.acknowledgementStatus.isBlank())
                                ? d.acknowledgementStatus
                                : (d.status != null ? d.status : "DELIVERED");
                        latestAckStatusMap.put(d.requestId, ackSt);
                    }
                }
            }
        }

        BranchConsolidatedReportDto report = new BranchConsolidatedReportDto();
        report.reportType = "REQUESTS";
        report.fromDate = finalFrom != null ? finalFrom.toString() : null;
        report.toDate = finalTo != null ? finalTo.toString() : null;

        List<BranchConsolidatedReportDto.BranchSummaryRowDto> summaryRows = new ArrayList<>();
        List<BranchConsolidatedReportDto.BranchDetailsGroupDto> detailsGroups = new ArrayList<>();
        Map<String, BigDecimal> grandTotals = new LinkedHashMap<>();
        Set<String> allDistinctItemKeys = new HashSet<>();

        for (Map.Entry<String, List<BranchRequest>> entry : byBranch.entrySet()) {
            String bKey = entry.getKey();
            List<BranchRequest> bRequests = entry.getValue();
            String bName = branchKeyToName.getOrDefault(bKey, "Unknown Branch");
            Long bId = branchKeyToId.get(bKey);

            Map<String, List<BranchRequest>> byItem = new LinkedHashMap<>();
            for (BranchRequest r : bRequests) {
                String cleanUnit = r.unit != null ? r.unit.trim().toUpperCase() : "";
                String dept = resolveDepartmentName(r.department, r.departmentId, r.category, deptCache);

                String iKey;
                if (Boolean.TRUE.equals(departmentBreakdown)) {
                    iKey = (r.itemId != null && r.itemId > 0)
                            ? ("ID_" + r.itemId + "___" + cleanUnit + "___" + dept.toLowerCase())
                            : ("NAME_" + (r.item != null ? r.item.trim().toLowerCase() : "") + "___" + cleanUnit + "___" + dept.toLowerCase());
                } else {
                    iKey = (r.itemId != null && r.itemId > 0)
                            ? ("ID_" + r.itemId + "___" + cleanUnit)
                            : ("NAME_" + (r.item != null ? r.item.trim().toLowerCase() : "") + "___" + cleanUnit);
                }
                byItem.computeIfAbsent(iKey, k -> new ArrayList<>()).add(r);
                allDistinctItemKeys.add(iKey);
            }

            List<BranchConsolidatedReportDto.ConsolidatedItemDto> branchItems = new ArrayList<>();
            Map<String, BigDecimal> branchUnitTotals = new LinkedHashMap<>();

            for (List<BranchRequest> iGroup : byItem.values()) {
                if (iGroup.isEmpty()) continue;
                BranchRequest first = iGroup.get(0);
                String itemName = first.item != null ? first.item.trim() : "Unknown Item";
                String unit = first.unit != null ? first.unit.trim().toUpperCase() : "";
                Long itemId = first.itemId;
                String dept = resolveDepartmentName(first.department, first.departmentId, first.category, deptCache);

                BigDecimal sumRequested = BigDecimal.ZERO;
                BigDecimal sumDispatched = BigDecimal.ZERO;
                BigDecimal sumReceived = BigDecimal.ZERO;
                LocalDate latestDelDate = null;
                String latestAckStatus = null;

                for (BranchRequest r : iGroup) {
                    sumRequested = sumRequested.add(BigDecimal.valueOf(r.requested));
                    sumDispatched = sumDispatched.add(BigDecimal.valueOf(r.dispatched));
                    sumReceived = sumReceived.add(BigDecimal.valueOf(r.received));

                    LocalDate dDate = (r.id != null) ? latestDispatchDateMap.get(r.id) : null;
                    if (dDate != null && (latestDelDate == null || dDate.isAfter(latestDelDate))) {
                        latestDelDate = dDate;
                    }
                    if (r.id != null && latestAckStatusMap.containsKey(r.id)) {
                        latestAckStatus = latestAckStatusMap.get(r.id);
                    }
                }

                double reqQty = sumRequested.setScale(3, RoundingMode.HALF_UP).doubleValue();
                double delQty = sumDispatched.setScale(3, RoundingMode.HALF_UP).doubleValue();
                double recQty = sumReceived.setScale(3, RoundingMode.HALF_UP).doubleValue();
                double pendingDelQty = Math.max(0, reqQty - delQty);

                String finalAckStatus;
                if (delQty <= 0) {
                    finalAckStatus = "PENDING_DELIVERY";
                } else if (recQty >= delQty) {
                    finalAckStatus = "ACKNOWLEDGED";
                } else if (latestAckStatus != null && !latestAckStatus.isBlank()) {
                    finalAckStatus = latestAckStatus;
                } else if (delQty < reqQty) {
                    finalAckStatus = "PARTIALLY_DELIVERED";
                } else {
                    finalAckStatus = "PENDING_ACKNOWLEDGEMENT";
                }

                BranchConsolidatedReportDto.ConsolidatedItemDto cItem = new BranchConsolidatedReportDto.ConsolidatedItemDto();
                cItem.itemId = itemId;
                cItem.itemName = itemName;
                cItem.department = Boolean.TRUE.equals(departmentBreakdown) ? dept : (dept != null && !dept.isBlank() ? dept : "All Departments");
                cItem.unit = unit;
                cItem.totalQuantity = reqQty;
                cItem.requestedQuantity = reqQty;
                cItem.deliveredQuantity = delQty;
                cItem.deliveryQuantity = pendingDelQty;
                cItem.deliveryDate = latestDelDate != null ? latestDelDate.toString() : null;
                cItem.acknowledgementStatus = finalAckStatus;
                branchItems.add(cItem);

                branchUnitTotals.merge(unit, sumRequested, BigDecimal::add);
                grandTotals.merge(unit, sumRequested, BigDecimal::add);
            }

            if (Boolean.TRUE.equals(departmentBreakdown)) {
                branchItems.sort(Comparator.comparing((BranchConsolidatedReportDto.ConsolidatedItemDto a) -> a.department != null ? a.department.toLowerCase() : "")
                        .thenComparing(a -> a.itemName != null ? a.itemName.toLowerCase() : ""));
            } else {
                branchItems.sort(Comparator.comparing(a -> a.itemName != null ? a.itemName.toLowerCase() : ""));
            }

            String bQtyFormatted = formatUnitTotals(branchUnitTotals);

            BranchConsolidatedReportDto.BranchSummaryRowDto sRow = new BranchConsolidatedReportDto.BranchSummaryRowDto();
            sRow.groupId = bId;
            sRow.groupName = bName;
            sRow.totalItems = branchItems.size();
            sRow.totalQuantityFormatted = bQtyFormatted;
            sRow.quantityByUnit = toDoubleMap(branchUnitTotals);
            summaryRows.add(sRow);

            BranchConsolidatedReportDto.BranchDetailsGroupDto dGroup = new BranchConsolidatedReportDto.BranchDetailsGroupDto();
            dGroup.groupId = bId;
            dGroup.groupName = bName;
            dGroup.items = branchItems;
            dGroup.totalItems = branchItems.size();
            dGroup.subtotalQuantityFormatted = bQtyFormatted;
            dGroup.subtotalQuantityByUnit = toDoubleMap(branchUnitTotals);
            detailsGroups.add(dGroup);
        }

        summaryRows.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));
        detailsGroups.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));

        report.totalGroups = summaryRows.size();
        report.overallTotalItems = allDistinctItemKeys.size();
        report.grandTotalQuantityFormatted = formatUnitTotals(grandTotals);
        report.grandTotalQuantityByUnit = toDoubleMap(grandTotals);
        report.summaryRows = summaryRows;
        report.detailsGroups = detailsGroups;

        return report;
    }

    public BranchConsolidatedReportDto getConsolidatedDispatchReport(
            LocalDate fromDate, LocalDate toDate, String branch, String department, String search, String status, Long orgId) {
        List<Dispatch> dispatches = (orgId != null)
                ? dispatchRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : dispatchRepo.findAllByOrderByCreatedAtDesc();

        LocalDate effectiveFrom = fromDate;
        LocalDate effectiveTo = toDate;
        if (effectiveFrom == null && effectiveTo == null) {
            effectiveFrom = LocalDate.now();
            effectiveTo = LocalDate.now();
        } else if (effectiveFrom != null && effectiveTo == null) {
            effectiveTo = effectiveFrom;
        }

        LocalDate finalFrom = effectiveFrom;
        LocalDate finalTo = effectiveTo;

        Map<Long, String> deptCache = buildDepartmentCache(orgId);

        List<Dispatch> filtered = dispatches.stream()
                .filter(d -> {
                    LocalDate dt = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                    if (finalFrom != null && (dt == null || dt.isBefore(finalFrom))) return false;
                    if (finalTo != null && (dt == null || dt.isAfter(finalTo))) return false;
                    if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                        if (!branch.equalsIgnoreCase(d.branchName)) return false;
                    }
                    String st = d.status != null && !d.status.isBlank() ? d.status : "PENDING";
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(st)) return false;
                    }
                    if (department != null && !department.isBlank() && !"ALL".equalsIgnoreCase(department)) {
                        String dept = resolveDepartmentName(d.department, d.departmentId, null, deptCache);
                        if (dept == null || !dept.equalsIgnoreCase(department.trim())) return false;
                    }
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchItem = d.itemName != null && d.itemName.toLowerCase().contains(s);
                        boolean matchBranch = d.branchName != null && d.branchName.toLowerCase().contains(s);
                        if (!matchItem && !matchBranch) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Map<String, List<Dispatch>> byBranch = new LinkedHashMap<>();
        Map<String, String> branchKeyToName = new HashMap<>();
        Map<String, Long> branchKeyToId = new HashMap<>();

        for (Dispatch d : filtered) {
            String bName = (d.branchName != null && !d.branchName.isBlank()) ? d.branchName.trim() : "Unknown Branch";
            String key = (d.branchId != null && d.branchId > 0) ? ("ID_" + d.branchId) : ("NAME_" + bName.toLowerCase());
            byBranch.computeIfAbsent(key, k -> new ArrayList<>()).add(d);
            branchKeyToName.putIfAbsent(key, bName);
            if (d.branchId != null) branchKeyToId.putIfAbsent(key, d.branchId);
        }

        BranchConsolidatedReportDto report = new BranchConsolidatedReportDto();
        report.reportType = "DISPATCHES";
        report.fromDate = finalFrom != null ? finalFrom.toString() : null;
        report.toDate = finalTo != null ? finalTo.toString() : null;

        List<BranchConsolidatedReportDto.BranchSummaryRowDto> summaryRows = new ArrayList<>();
        List<BranchConsolidatedReportDto.BranchDetailsGroupDto> detailsGroups = new ArrayList<>();
        Map<String, BigDecimal> grandTotals = new LinkedHashMap<>();
        Set<String> allDistinctItemKeys = new HashSet<>();

        for (Map.Entry<String, List<Dispatch>> entry : byBranch.entrySet()) {
            String bKey = entry.getKey();
            List<Dispatch> bDispatches = entry.getValue();
            String bName = branchKeyToName.getOrDefault(bKey, "Unknown Branch");
            Long bId = branchKeyToId.get(bKey);

            Map<String, List<Dispatch>> byItem = new LinkedHashMap<>();
            for (Dispatch d : bDispatches) {
                String cleanUnit = d.unit != null ? d.unit.trim().toUpperCase() : "";
                String iKey = (d.itemId != null && d.itemId > 0) ? ("ID_" + d.itemId + "___" + cleanUnit) : ("NAME_" + (d.itemName != null ? d.itemName.trim().toLowerCase() : "") + "___" + cleanUnit);
                byItem.computeIfAbsent(iKey, k -> new ArrayList<>()).add(d);
                allDistinctItemKeys.add(iKey);
            }

            List<BranchConsolidatedReportDto.ConsolidatedItemDto> branchItems = new ArrayList<>();
            Map<String, BigDecimal> branchUnitTotals = new LinkedHashMap<>();

            for (List<Dispatch> iGroup : byItem.values()) {
                if (iGroup.isEmpty()) continue;
                Dispatch first = iGroup.get(0);
                String itemName = first.itemName != null ? first.itemName.trim() : "Unknown Item";
                String unit = first.unit != null ? first.unit.trim().toUpperCase() : "";
                Long itemId = first.itemId;

                BigDecimal sumQty = BigDecimal.ZERO;
                for (Dispatch d : iGroup) {
                    sumQty = sumQty.add(BigDecimal.valueOf(d.quantity));
                }

                BranchConsolidatedReportDto.ConsolidatedItemDto cItem = new BranchConsolidatedReportDto.ConsolidatedItemDto();
                cItem.itemId = itemId;
                cItem.itemName = itemName;
                cItem.department = resolveDepartmentName(first.department, first.departmentId, null, deptCache);
                cItem.unit = unit;
                cItem.totalQuantity = sumQty.setScale(3, RoundingMode.HALF_UP).doubleValue();
                branchItems.add(cItem);

                branchUnitTotals.merge(unit, sumQty, BigDecimal::add);
                grandTotals.merge(unit, sumQty, BigDecimal::add);
            }

            branchItems.sort(Comparator.comparing(a -> a.itemName != null ? a.itemName.toLowerCase() : ""));

            String bQtyFormatted = formatUnitTotals(branchUnitTotals);

            BranchConsolidatedReportDto.BranchSummaryRowDto sRow = new BranchConsolidatedReportDto.BranchSummaryRowDto();
            sRow.groupId = bId;
            sRow.groupName = bName;
            sRow.totalItems = branchItems.size();
            sRow.totalQuantityFormatted = bQtyFormatted;
            sRow.quantityByUnit = toDoubleMap(branchUnitTotals);
            summaryRows.add(sRow);

            BranchConsolidatedReportDto.BranchDetailsGroupDto dGroup = new BranchConsolidatedReportDto.BranchDetailsGroupDto();
            dGroup.groupId = bId;
            dGroup.groupName = bName;
            dGroup.items = branchItems;
            dGroup.totalItems = branchItems.size();
            dGroup.subtotalQuantityFormatted = bQtyFormatted;
            dGroup.subtotalQuantityByUnit = toDoubleMap(branchUnitTotals);
            detailsGroups.add(dGroup);
        }

        summaryRows.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));
        detailsGroups.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));

        report.totalGroups = summaryRows.size();
        report.overallTotalItems = allDistinctItemKeys.size();
        report.grandTotalQuantityFormatted = formatUnitTotals(grandTotals);
        report.grandTotalQuantityByUnit = toDoubleMap(grandTotals);
        report.summaryRows = summaryRows;
        report.detailsGroups = detailsGroups;

        return report;
    }

    public BranchConsolidatedReportDto getConsolidatedCentralInventoryReport(
            LocalDate fromDate, LocalDate toDate, String search, Long orgId) {
        List<Item> items = (orgId != null)
                ? itemRepo.findByOrganisationIdOrderByNameAsc(orgId)
                : itemRepo.findAllByOrderByNameAsc();

        List<Item> filtered = items.stream()
                .filter(it -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.trim().toLowerCase();
                        boolean matchName = it.name != null && it.name.toLowerCase().contains(s);
                        boolean matchCat = it.category != null && it.category.toLowerCase().contains(s);
                        if (!matchName && !matchCat) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        Map<String, List<Item>> byCategory = new LinkedHashMap<>();
        Map<String, String> catKeyToName = new HashMap<>();
        Map<String, Long> catKeyToId = new HashMap<>();

        for (Item it : filtered) {
            String catName = (it.category != null && !it.category.isBlank()) ? it.category.trim() : "General";
            String key = (it.categoryId != null && it.categoryId > 0) ? ("ID_" + it.categoryId) : ("NAME_" + catName.toLowerCase());
            byCategory.computeIfAbsent(key, k -> new ArrayList<>()).add(it);
            catKeyToName.putIfAbsent(key, catName);
            if (it.categoryId != null) catKeyToId.putIfAbsent(key, it.categoryId);
        }

        BranchConsolidatedReportDto report = new BranchConsolidatedReportDto();
        report.reportType = "INVENTORY";
        report.fromDate = fromDate != null ? fromDate.toString() : null;
        report.toDate = toDate != null ? toDate.toString() : null;

        List<BranchConsolidatedReportDto.BranchSummaryRowDto> summaryRows = new ArrayList<>();
        List<BranchConsolidatedReportDto.BranchDetailsGroupDto> detailsGroups = new ArrayList<>();
        Map<String, BigDecimal> grandTotals = new LinkedHashMap<>();

        for (Map.Entry<String, List<Item>> entry : byCategory.entrySet()) {
            String cKey = entry.getKey();
            List<Item> cItems = entry.getValue();
            String cName = catKeyToName.getOrDefault(cKey, "General");
            Long cId = catKeyToId.get(cKey);

            List<BranchConsolidatedReportDto.ConsolidatedItemDto> groupItems = new ArrayList<>();
            Map<String, BigDecimal> catUnitTotals = new LinkedHashMap<>();

            for (Item it : cItems) {
                String unit = it.unit != null ? it.unit.trim().toUpperCase() : "";
                BigDecimal qty = BigDecimal.valueOf(it.stock);

                BranchConsolidatedReportDto.ConsolidatedItemDto cItem = new BranchConsolidatedReportDto.ConsolidatedItemDto();
                cItem.itemId = it.id;
                cItem.itemName = it.name;
                cItem.unit = unit;
                cItem.totalQuantity = qty.setScale(3, RoundingMode.HALF_UP).doubleValue();
                groupItems.add(cItem);

                catUnitTotals.merge(unit, qty, BigDecimal::add);
                grandTotals.merge(unit, qty, BigDecimal::add);
            }

            groupItems.sort(Comparator.comparing(a -> a.itemName != null ? a.itemName.toLowerCase() : ""));
            String cQtyFormatted = formatUnitTotals(catUnitTotals);

            BranchConsolidatedReportDto.BranchSummaryRowDto sRow = new BranchConsolidatedReportDto.BranchSummaryRowDto();
            sRow.groupId = cId;
            sRow.groupName = cName;
            sRow.totalItems = groupItems.size();
            sRow.totalQuantityFormatted = cQtyFormatted;
            sRow.quantityByUnit = toDoubleMap(catUnitTotals);
            summaryRows.add(sRow);

            BranchConsolidatedReportDto.BranchDetailsGroupDto dGroup = new BranchConsolidatedReportDto.BranchDetailsGroupDto();
            dGroup.groupId = cId;
            dGroup.groupName = cName;
            dGroup.items = groupItems;
            dGroup.totalItems = groupItems.size();
            dGroup.subtotalQuantityFormatted = cQtyFormatted;
            dGroup.subtotalQuantityByUnit = toDoubleMap(catUnitTotals);
            detailsGroups.add(dGroup);
        }

        summaryRows.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));
        detailsGroups.sort(Comparator.comparing(a -> a.groupName != null ? a.groupName.toLowerCase() : ""));

        report.totalGroups = summaryRows.size();
        report.overallTotalItems = filtered.size();
        report.grandTotalQuantityFormatted = formatUnitTotals(grandTotals);
        report.grandTotalQuantityByUnit = toDoubleMap(grandTotals);
        report.summaryRows = summaryRows;
        report.detailsGroups = detailsGroups;

        return report;
    }

    private String formatUnitTotals(Map<String, BigDecimal> totals) {
        if (totals == null || totals.isEmpty()) {
            return "0";
        }
        return totals.entrySet().stream()
                .map(e -> {
                    BigDecimal qty = e.getValue().setScale(3, RoundingMode.HALF_UP).stripTrailingZeros();
                    String qtyStr = qty.toPlainString();
                    String unit = e.getKey();
                    return unit != null && !unit.isBlank() ? (qtyStr + " " + unit) : qtyStr;
                })
                .collect(Collectors.joining(", "));
    }

    private Map<String, Double> toDoubleMap(Map<String, BigDecimal> source) {
        if (source == null) return Collections.emptyMap();
        Map<String, Double> result = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> e : source.entrySet()) {
            result.put(e.getKey(), e.getValue().setScale(3, RoundingMode.HALF_UP).doubleValue());
        }
        return result;
    }
}