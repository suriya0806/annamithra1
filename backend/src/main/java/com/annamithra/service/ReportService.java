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

    public ReportService(ItemRepository itemRepo,
                         PurchaseOrderRepository poRepo,
                         BranchRequestRepository requestRepo,
                         DispatchRepository dispatchRepo,
                         InventoryTransactionRepository transactionRepo) {
        this.itemRepo = itemRepo;
        this.poRepo = poRepo;
        this.requestRepo = requestRepo;
        this.dispatchRepo = dispatchRepo;
        this.transactionRepo = transactionRepo;
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
                        if (fromDate != null && orderCreatedDate != null && orderCreatedDate.isBefore(fromDate)) return false;
                        if (toDate != null && orderCreatedDate != null && orderCreatedDate.isAfter(toDate)) return false;
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
                        if (fromDate != null && txDate != null && txDate.isBefore(fromDate)) return false;
                        if (toDate != null && txDate != null && txDate.isAfter(toDate)) return false;
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
        return getBranchRequestReport(fromDate, toDate, branch, search, status, null, orgId);
    }

    public List<BranchRequestReportDto> getBranchRequestReport(LocalDate fromDate, LocalDate toDate, String branch, String search, String status, String category, Long orgId) {
        List<BranchRequest> requests = (orgId != null)
                ? requestRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : requestRepo.findAllByOrderByCreatedAtDesc();

        return requests.stream()
                .filter(r -> {
                    if (fromDate != null && r.requestDate != null && r.requestDate.isBefore(fromDate)) return false;
                    if (toDate != null && r.requestDate != null && r.requestDate.isAfter(toDate)) return false;
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
                        r.item,
                        r.unit,
                        r.category,
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
        if (!reqIds.isEmpty()) {
            for (BranchRequest r : requestRepo.findAllById(reqIds)) {
                if (r.id != null) {
                    requestQtyCache.put(r.id, r.requested);
                    if (r.category != null) {
                        requestCategoryCache.put(r.id, r.category);
                    }
                }
            }
        }

        return dispatches.stream()
                .filter(d -> {
                    LocalDate dt = d.dispatchDate != null ? d.dispatchDate : (d.createdAt != null ? d.createdAt.toLocalDate() : null);
                    if (date != null) {
                        if (dt == null || !dt.equals(date)) return false;
                    } else {
                        if (fromDate != null && dt != null && dt.isBefore(fromDate)) return false;
                        if (toDate != null && dt != null && dt.isAfter(toDate)) return false;
                    }
                    if (branch != null && !branch.isBlank() && !"ALL".equalsIgnoreCase(branch)) {
                        if (!branch.equalsIgnoreCase(d.branchName)) return false;
                    }
                    String st = d.status != null && !d.status.isBlank() ? d.status : "PENDING";
                    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                        if (!status.equalsIgnoreCase(st)) return false;
                    }
                    String cat = (d.department != null && !d.department.isBlank()) ? d.department.trim() : (d.requestId != null ? requestCategoryCache.get(d.requestId) : null); if (cat == null && d.itemName != null) { cat = itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, d.itemName.trim()).map(it -> it.category).orElse(null); }
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
                    String cat = (d.department != null && !d.department.isBlank()) ? d.department.trim() : (d.requestId != null ? requestCategoryCache.get(d.requestId) : null); if (cat == null && d.itemName != null) { cat = itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, d.itemName.trim()).map(it -> it.category).orElse(null); }

                    return new BranchDispatchReportDto(
                            d.id,
                            d.dispatchNumber,
                            d.dispatchDate,
                            dtTime,
                            d.branchName,
                            d.itemName,
                            d.unit,
                            cat,
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
}
