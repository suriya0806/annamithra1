package com.annamithra.service;

import com.annamithra.dto.OrgNewItemOrderRequest;
import com.annamithra.dto.StoreOrderRequest;
import com.annamithra.model.InventoryTransaction;
import com.annamithra.model.Item;
import com.annamithra.model.PurchaseOrder;
import com.annamithra.model.PurchaseReceipt;
import com.annamithra.repository.InventoryTransactionRepository;
import com.annamithra.repository.ItemRepository;
import com.annamithra.repository.PurchaseOrderRepository;
import com.annamithra.repository.PurchaseReceiptRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.annamithra.dto.PurchaseOrderGroupDto;
import com.annamithra.model.PurchaseOrderHeader;
import com.annamithra.repository.PurchaseOrderHeaderRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class PurchaseOrderService {
    private final PurchaseOrderRepository orderRepo;
    private final PurchaseOrderHeaderRepository headerRepo;
    private final ItemRepository itemRepo;
    private final PurchaseReceiptRepository receiptRepo;
    private final InventoryTransactionRepository transactionRepo;
    private final JdbcTemplate jdbcTemplate;
    private final Map<String, Long> lastSubmitTimeByUser = new java.util.concurrent.ConcurrentHashMap<>();

    public PurchaseOrderService(PurchaseOrderRepository orderRepo, PurchaseOrderHeaderRepository headerRepo,
                                ItemRepository itemRepo, PurchaseReceiptRepository receiptRepo,
                                InventoryTransactionRepository transactionRepo,
                                JdbcTemplate jdbcTemplate) {
        this.orderRepo = orderRepo;
        this.headerRepo = headerRepo;
        this.itemRepo = itemRepo;
        this.receiptRepo = receiptRepo;
        this.transactionRepo = transactionRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    // Organisation Admin: New Item Purchase Order
    @Transactional
    public List<PurchaseOrder> createOrgNewItemsOrder(OrgNewItemOrderRequest req, String adminUsername, Long orgId) {
        if (req == null || req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order must contain at least one item");
        }

        String poBatch = "PO-ORG-" + System.currentTimeMillis();
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        List<PurchaseOrder> created = new ArrayList<>();

        for (OrgNewItemOrderRequest.NewItemLine line : req.items) {
            if (line.name == null || line.name.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name cannot be blank");
            }
            if (line.unit == null || line.unit.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit cannot be blank for " + line.name);
            }
            if (line.quantity <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quantity must be positive for " + line.name);
            }

            String itemName = line.name.trim();
            String unit = line.unit.trim().toUpperCase();

            // Make available in central item catalogue for this organisation
            itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, itemName).orElseGet(() -> {
                Item item = new Item(itemName, unit, 0);
                item.organisationId = orgId;
                return itemRepo.save(item);
            });

            PurchaseOrder po = new PurchaseOrder();
            po.poNumber = poBatch;
            po.source = "ORGANISATION_ADMIN";
            po.item = itemName;
            po.unit = unit;
            po.requiredQuantity = 0;
            po.quantity = line.quantity;
            po.receivedQty = 0;
            po.status = "ORDERED"; // Org admin placed order with supplier
            po.orderDate = today;
            po.createdAt = now;
            po.orderedAt = now;
            po.orderedBy = adminUsername != null ? adminUsername : "Organisation Admin";
            po.organisationId = orgId;

            created.add(orderRepo.save(po));
        }

        return created;
    }

    // Organisation Admin: View purchase requests submitted by Store Manager
    public List<PurchaseOrder> getStoreManagerRequestedOrders(Long orgId) {
        if (orgId != null) {
            return orderRepo.findStoreManagerRequestsByOrganisationId(orgId);
        }
        return orderRepo.findStoreManagerRequests();
    }

    // Organisation Admin: Mark purchase order as Ordered after placing with supplier
    @Transactional
    public PurchaseOrder markOrderAsOrdered(Long id, String adminUsername, Long orgId) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Purchase order ID cannot be null");
        }
        PurchaseOrder po = orderRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase order not found with ID " + id));

        if (orgId != null && po.organisationId != null && !po.organisationId.equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access order from another organisation");
        }

        if ("ORDERED".equalsIgnoreCase(po.status) || "RECEIVED".equalsIgnoreCase(po.status)) {
            return po;
        }

        po.status = "ORDERED";
        po.orderedAt = LocalDateTime.now();
        po.orderedBy = adminUsername != null ? adminUsername : "Organisation Admin";
        return orderRepo.save(po);
    }

    // Organisation Admin & General: History report
    public List<PurchaseOrder> getOrderHistory(LocalDate date, LocalDate fromDate, LocalDate toDate, String item, Long orgId) {
        List<PurchaseOrder> all = (orgId != null) 
            ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : orderRepo.findAllByOrderByCreatedAtDesc();

        return all.stream()
            .filter(po -> {
                LocalDate d = po.orderDate != null ? po.orderDate : (po.createdAt != null ? po.createdAt.toLocalDate() : null);
                if (date != null) {
                    return d != null && d.equals(date);
                }
                if (fromDate != null && (d == null || d.isBefore(fromDate))) return false;
                if (toDate != null && (d == null || d.isAfter(toDate))) return false;
                return true;
            })
            .filter(po -> item == null || item.isBlank() || (po.item != null && po.item.toLowerCase().contains(item.trim().toLowerCase())))
            .toList();
    }

    // Organisation Admin: Placed new item orders view
    public List<PurchaseOrder> getOrgNewItemOrders(LocalDate date, LocalDate fromDate, LocalDate toDate, String search, Long orgId) {
        List<PurchaseOrder> all = (orgId != null)
            ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : orderRepo.findAllByOrderByCreatedAtDesc();

        return all.stream()
            .filter(po -> "ORGANISATION_ADMIN".equalsIgnoreCase(po.source) || (po.poNumber != null && po.poNumber.startsWith("PO-ORG-")))
            .filter(po -> {
                LocalDate d = po.orderDate != null ? po.orderDate : (po.createdAt != null ? po.createdAt.toLocalDate() : null);
                if (date != null) {
                    return d != null && d.equals(date);
                }
                if (fromDate != null && (d == null || d.isBefore(fromDate))) return false;
                if (toDate != null && (d == null || d.isAfter(toDate))) return false;
                return true;
            })
            .filter(po -> search == null || search.isBlank() || (po.item != null && po.item.toLowerCase().contains(search.trim().toLowerCase())) || (po.poNumber != null && po.poNumber.toLowerCase().contains(search.trim().toLowerCase())))
            .toList();
    }

    // Store Manager: View all purchase orders sent to Organisation Admin
    public List<PurchaseOrder> getStoreManagerOrdersView(LocalDate date, LocalDate fromDate, LocalDate toDate, String item, Long orgId) {
        return getOrderHistory(date, fromDate, toDate, item, orgId);
    }

    // Store Manager: Entry - Purchase orders marked Ordered for receiving
    public List<PurchaseOrder> getOrdersForReceiving(LocalDate date, LocalDate fromDate, LocalDate toDate, Long orgId) {
        List<PurchaseOrder> all = (orgId != null)
            ? orderRepo.findOrderedForReceivingByOrganisationId(orgId)
            : orderRepo.findOrderedForReceiving();

        return all.stream()
            .filter(po -> {
                LocalDate d = po.orderDate != null ? po.orderDate : (po.createdAt != null ? po.createdAt.toLocalDate() : null);
                if (date != null) {
                    return d != null && d.equals(date);
                }
                if (fromDate != null && (d == null || d.isBefore(fromDate))) return false;
                if (toDate != null && (d == null || d.isAfter(toDate))) return false;
                return true;
            })
            .toList();
    }

    // Store Manager: Confirm actual receipt of goods
    @Transactional
    public PurchaseOrder receiveOrderGoods(Long id, double receivedQty, String managerUsername, Long orgId) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Purchase order ID cannot be null");
        }
        if (receivedQty <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Received quantity must be positive");
        }

        PurchaseOrder po = orderRepo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Purchase order not found with ID " + id));

        if (orgId != null && po.organisationId != null && !po.organisationId.equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access order from another organisation");
        }

        if (!"ORDERED".equalsIgnoreCase(po.status) && !"PARTIALLY_RECEIVED".equalsIgnoreCase(po.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order must be in ORDERED or PARTIALLY_RECEIVED status before receiving goods");
        }

        double remaining = po.getRemainingToReceive();
        if (receivedQty > remaining) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Received quantity (" + receivedQty + ") cannot exceed remaining outstanding quantity (" + remaining + ")");
        }

        // 1. Record receipt transaction
        PurchaseReceipt receipt = new PurchaseReceipt(
            po.id,
            po.item,
            po.unit,
            receivedQty,
            managerUsername != null ? managerUsername : "Store Manager"
        );
        receipt.organisationId = po.organisationId != null ? po.organisationId : orgId;
        receiptRepo.save(receipt);

        // 2. Increase central inventory
        Long itemOrgId = po.organisationId != null ? po.organisationId : orgId;
        Item item = itemRepo.findByOrganisationIdAndNameIgnoreCase(itemOrgId, po.item).orElseGet(() -> {
            Item newItem = new Item(po.item, po.unit, 0);
            newItem.organisationId = itemOrgId;
            return itemRepo.save(newItem);
        });

        item.stock += receivedQty;
        itemRepo.save(item);

        // 3. Record inventory audit transaction
        InventoryTransaction tx = new InventoryTransaction(
            item.name,
            item.unit,
            "RECEIPT",
            receivedQty,
            "PURCHASE_RECEIPT",
            po.id,
            item.stock,
            managerUsername != null ? managerUsername : "Store Manager"
        );
        tx.organisationId = itemOrgId;
        transactionRepo.save(tx);

        // 4. Update purchase order's cumulative received quantity and status
        po.receivedQty += receivedQty;
        po.status = (po.receivedQty >= po.quantity) ? "RECEIVED" : "PARTIALLY_RECEIVED";
        PurchaseOrder savedPo = orderRepo.save(po);

        // 5. Sync header status if linked
        if (savedPo.poNumber != null && !savedPo.poNumber.isBlank()) {
            Optional<PurchaseOrderHeader> headerOpt = (itemOrgId != null)
                ? headerRepo.findByOrganisationIdAndOrderNumberIgnoreCase(itemOrgId, savedPo.poNumber.trim())
                : headerRepo.findByOrderNumberIgnoreCase(savedPo.poNumber.trim());

            headerOpt.ifPresent(h -> {
                List<PurchaseOrder> siblings = (itemOrgId != null)
                    ? orderRepo.findByOrganisationIdAndPoNumberIgnoreCaseOrderByCreatedAtAsc(itemOrgId, savedPo.poNumber.trim())
                    : orderRepo.findByPoNumberIgnoreCaseOrderByCreatedAtAsc(savedPo.poNumber.trim());

                boolean allDone = true;
                boolean anyStarted = false;
                for (PurchaseOrder s : siblings) {
                    if (s.receivedQty < s.quantity) allDone = false;
                    if (s.receivedQty > 0) anyStarted = true;
                }
                h.status = allDone ? "RECEIVED" : (anyStarted ? "PARTIALLY_RECEIVED" : h.status);
                headerRepo.save(h);
            });
        }

        return savedPo;
    }

    public List<PurchaseReceipt> getReceiptsByPurchaseOrderId(Long poId, Long orgId) {
        if (poId == null) return List.of();
        List<PurchaseReceipt> list = receiptRepo.findByPurchaseOrderIdOrderByReceiptDateDesc(poId);
        if (orgId != null) {
            return list.stream().filter(r -> r.organisationId == null || r.organisationId.equals(orgId)).toList();
        }
        return list;
    }

    public List<PurchaseReceipt> getReceiptsByOrderNumber(String orderNumber, Long orgId) {
        if (orderNumber == null || orderNumber.isBlank()) return List.of();
        List<PurchaseOrder> lines = (orgId != null)
            ? orderRepo.findByOrganisationIdAndPoNumberIgnoreCaseOrderByCreatedAtAsc(orgId, orderNumber.trim())
            : orderRepo.findByPoNumberIgnoreCaseOrderByCreatedAtAsc(orderNumber.trim());

        List<Long> ids = lines.stream().map(l -> l.id).filter(java.util.Objects::nonNull).toList();
        if (ids.isEmpty()) return List.of();
        return receiptRepo.findByPurchaseOrderIdInOrderByReceiptDateDesc(ids);
    }

    // Generate unique order number (e.g. ORDER01, ORDER02, ...)
    public synchronized String generateNextOrderNumber(Long orgId) {
        List<PurchaseOrderHeader> headers = (orgId != null) ? headerRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId) : headerRepo.findAll();
        List<PurchaseOrder> orders = (orgId != null) ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId) : orderRepo.findAll();
        int max = 0;

        Set<String> allNums = new HashSet<>();
        for (PurchaseOrderHeader h : headers) {
            if (h.orderNumber != null) allNums.add(h.orderNumber.toUpperCase().trim());
        }
        for (PurchaseOrder po : orders) {
            if (po.poNumber != null) allNums.add(po.poNumber.toUpperCase().trim());
        }

        for (String num : allNums) {
            if (num.startsWith("ORDER")) {
                String suffix = num.substring(5).replaceAll("[^0-9]", "");
                if (!suffix.isEmpty()) {
                    try {
                        int val = Integer.parseInt(suffix);
                        if (val > max) max = val;
                    } catch (NumberFormatException ignored) {}
                }
            }
        }

        return String.format("ORDER%02d", max + 1);
    }

    // Store Manager: Consolidate requirements and send order to Organisation Admin
    @Transactional
    public List<PurchaseOrder> createStoreManagerOrder(StoreOrderRequest req, String managerUsername, Long orgId) {
        if (req == null || req.items == null || req.items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Purchase order must contain at least one item");
        }

        // Prevent duplicate submissions caused by double-clicking
        String userKey = (managerUsername != null ? managerUsername : "Store Manager") + "_" + (orgId != null ? orgId : 0);
        long nowMs = System.currentTimeMillis();
        Long lastTime = lastSubmitTimeByUser.get(userKey);
        if (lastTime != null && (nowMs - lastTime) < 1000) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Order submission in progress. Please wait a moment.");
        }
        lastSubmitTimeByUser.put(userKey, nowMs);

        String orderNumber = generateNextOrderNumber(orgId);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();

        // 1. Save Purchase Order Header
        PurchaseOrderHeader header = new PurchaseOrderHeader(orderNumber, "STORE_MANAGER", managerUsername != null ? managerUsername : "Store Manager");
        header.organisationId = orgId;
        header = headerRepo.save(header);

        // 2. Save Item Lines
        List<PurchaseOrder> created = new ArrayList<>();
        for (StoreOrderRequest.OrderItem itemLine : req.items) {
            if (itemLine.orderQuantity <= 0) {
                continue; // Skip items where order quantity was set to 0
            }
            if (itemLine.itemName == null || itemLine.itemName.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Item name cannot be blank");
            }
            if (itemLine.unit == null || itemLine.unit.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unit cannot be blank for " + itemLine.itemName);
            }

            String itemName = itemLine.itemName.trim();
            String unit = itemLine.unit.trim().toUpperCase();

            // Ensure catalogue item exists for this organisation
            itemRepo.findByOrganisationIdAndNameIgnoreCase(orgId, itemName).orElseGet(() -> {
                Item newItem = new Item(itemName, unit, 0);
                newItem.organisationId = orgId;
                return itemRepo.save(newItem);
            });

            PurchaseOrder po = new PurchaseOrder();
            po.poNumber = orderNumber;
            po.headerId = header.id;
            po.source = "STORE_MANAGER";
            po.item = itemName;
            po.unit = unit;
            po.requiredQuantity = itemLine.requiredQuantity; // Preserve original required quantity
            po.quantity = itemLine.orderQuantity; // Submitted order quantity
            po.receivedQty = 0;
            po.status = "PENDING"; // Awaiting Organisation Admin review
            po.orderDate = today;
            po.requestDate = itemLine.requestDate != null ? itemLine.requestDate : today;
            po.createdAt = now;
            po.orderedBy = managerUsername != null ? managerUsername : "Store Manager";
            po.organisationId = orgId;

            created.add(orderRepo.save(po));
        }

        if (created.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter at least one item with a positive order quantity");
        }

        return created;
    }

    // Store Manager: Get purchase orders successfully submitted today (Already Ordered Today)
    public List<PurchaseOrderGroupDto> getAlreadyOrderedToday(LocalDate date, Long orgId) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        List<PurchaseOrder> allOrders = (orgId != null) 
            ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : orderRepo.findAllByOrderByCreatedAtDesc();

        Map<String, PurchaseOrderGroupDto> groups = new LinkedHashMap<>();

        for (PurchaseOrder po : allOrders) {
            if (po.poNumber == null || po.poNumber.isBlank()) continue;
            // Only orders submitted through Store Manager workflow
            if (!"STORE_MANAGER".equalsIgnoreCase(po.source) && !po.poNumber.toUpperCase().startsWith("ORDER")) {
                continue;
            }
            // Do not include draft orders, failed submissions, or cancelled orders
            if ("CANCELLED".equalsIgnoreCase(po.status) || "FAILED".equalsIgnoreCase(po.status)) {
                continue;
            }

            LocalDate createdDate = po.createdAt != null ? po.createdAt.toLocalDate() : po.orderDate;
            if (createdDate == null || !createdDate.equals(targetDate)) {
                continue;
            }

            String key = po.poNumber.trim();
            PurchaseOrderGroupDto group = groups.computeIfAbsent(key, k -> {
                PurchaseOrderHeader h = (orgId != null)
                    ? headerRepo.findByOrganisationIdAndOrderNumberIgnoreCase(orgId, k).orElse(null)
                    : headerRepo.findByOrderNumberIgnoreCase(k).orElse(null);

                LocalDateTime creationTime = (h != null && h.createdAt != null) ? h.createdAt : (po.createdAt != null ? po.createdAt : LocalDateTime.now());
                String status = (h != null && h.status != null) ? h.status : (po.status != null ? po.status : "PENDING");
                String createdBy = (h != null && h.createdBy != null) ? h.createdBy : (po.orderedBy != null ? po.orderedBy : "Store Manager");
                return new PurchaseOrderGroupDto(
                    k,
                    "STORE_MANAGER",
                    status,
                    creationTime.toLocalDate(),
                    creationTime,
                    createdBy
                );
            });
            group.lines.add(po);
        }

        return new ArrayList<>(groups.values());
    }

    // Store Manager & Org Admin: Get list of previously submitted purchase orders
    public List<PurchaseOrderGroupDto> getPreviousOrders(LocalDate date, LocalDate fromDate, LocalDate toDate, Long orgId) {
        List<PurchaseOrder> allOrders = (orgId != null)
            ? orderRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
            : orderRepo.findAllByOrderByCreatedAtDesc();

        Map<String, PurchaseOrderHeader> headerMap = new HashMap<>();
        try {
            List<PurchaseOrderHeader> headers = (orgId != null)
                ? headerRepo.findByOrganisationIdOrderByCreatedAtDesc(orgId)
                : headerRepo.findAll();

            for (PurchaseOrderHeader h : headers) {
                if (h.orderNumber != null && !h.orderNumber.isBlank()) {
                    headerMap.put(h.orderNumber.trim().toUpperCase(), h);
                }
            }
        } catch (Exception ignored) {}

        Map<String, PurchaseOrderGroupDto> groups = new LinkedHashMap<>();

        for (PurchaseOrder po : allOrders) {
            if (po.poNumber == null || po.poNumber.isBlank()) continue;
            String key = po.poNumber.trim();
            PurchaseOrderGroupDto group = groups.computeIfAbsent(key, k -> {
                PurchaseOrderHeader hdr = headerMap.get(k.toUpperCase());
                LocalDate poDate = hdr != null && hdr.orderDate != null ? hdr.orderDate : (po.orderDate != null ? po.orderDate : LocalDate.now());
                LocalDateTime created = hdr != null && hdr.createdAt != null ? hdr.createdAt : (po.createdAt != null ? po.createdAt : (poDate != null ? poDate.atStartOfDay() : null));
                String src = hdr != null && hdr.source != null ? hdr.source : (po.source != null ? po.source : "STORE_MANAGER");
                String st = hdr != null && hdr.status != null ? hdr.status : (po.status != null ? po.status : "PENDING");
                String by = hdr != null && hdr.createdBy != null ? hdr.createdBy : (po.orderedBy != null ? po.orderedBy : "Store Manager");

                return new PurchaseOrderGroupDto(
                    k,
                    src,
                    st,
                    poDate,
                    created,
                    by
                );
            });
            group.lines.add(po);
        }

        // Return only orders submitted by STORE_MANAGER or with ORDER/PO prefix
        List<PurchaseOrderGroupDto> result = new ArrayList<>();
        for (PurchaseOrderGroupDto g : groups.values()) {
            if ("STORE_MANAGER".equalsIgnoreCase(g.source) || g.orderNumber.toUpperCase().startsWith("ORDER") || g.orderNumber.toUpperCase().startsWith("PO-")) {
                LocalDate gDate = g.orderDate != null ? g.orderDate : (g.createdAt != null ? g.createdAt.toLocalDate() : null);
                if (date != null) {
                    if (gDate == null || !gDate.equals(date)) {
                        continue;
                    }
                }
                if (fromDate != null && (gDate == null || gDate.isBefore(fromDate))) {
                    continue;
                }
                if (toDate != null && (gDate == null || gDate.isAfter(toDate))) {
                    continue;
                }
                result.add(g);
            }
        }
        return result;
    }

    // Get order details by orderNumber (for View Order popup & Download PDF)
    public PurchaseOrderGroupDto getOrderByOrderNumber(String orderNumber, Long orgId) {
        if (orderNumber == null || orderNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order number cannot be blank");
        }

        List<PurchaseOrder> lines = (orgId != null)
            ? orderRepo.findByOrganisationIdAndPoNumberIgnoreCaseOrderByCreatedAtAsc(orgId, orderNumber.trim())
            : orderRepo.findByPoNumberIgnoreCaseOrderByCreatedAtAsc(orderNumber.trim());

        if (lines.isEmpty() && orderNumber.trim().toUpperCase().startsWith("PO-")) {
            try {
                Long poId = Long.parseLong(orderNumber.trim().substring(3));
                orderRepo.findById(poId).ifPresent(p -> {
                    if (orgId == null || p.organisationId == null || p.organisationId.equals(orgId)) {
                        lines.add(p);
                    }
                });
            } catch (Exception ignored) {}
        }
        if (lines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No purchase order found for " + orderNumber);
        }

        PurchaseOrder first = lines.get(0);
        Optional<PurchaseOrderHeader> headerOpt = (orgId != null)
            ? headerRepo.findByOrganisationIdAndOrderNumberIgnoreCase(orgId, orderNumber.trim())
            : headerRepo.findByOrderNumberIgnoreCase(orderNumber.trim());

        LocalDate orderDate = headerOpt.map(h -> h.orderDate).orElse(first.orderDate != null ? first.orderDate : LocalDate.now());
        LocalDateTime createdAt = headerOpt.map(h -> h.createdAt).orElse(null);
        if (createdAt == null) {
            for (PurchaseOrder l : lines) {
                if (l.createdAt != null) {
                    createdAt = l.createdAt;
                    break;
                }
            }
        }
        if (createdAt == null && orderDate != null) {
            createdAt = orderDate.atStartOfDay();
        }

        String source = headerOpt.map(h -> h.source).orElse(first.source != null ? first.source : "STORE_MANAGER");
        String status = headerOpt.map(h -> h.status).orElse(first.status != null ? first.status : "PENDING");
        String orderedBy = headerOpt.map(h -> h.createdBy).orElse(first.orderedBy);

        PurchaseOrderGroupDto dto = new PurchaseOrderGroupDto(
            orderNumber.trim(),
            source,
            status,
            orderDate,
            createdAt,
            orderedBy
        );
        dto.lines = lines;
        return dto;
    }

    // Organisation Admin: View purchase requests grouped by orderNumber
    public List<PurchaseOrderGroupDto> getRequestedOrdersGrouped(LocalDate date, LocalDate fromDate, LocalDate toDate, Long orgId) {
        return getPreviousOrders(date, fromDate, toDate, orgId);
    }

    // Organisation Admin: Mark entire purchase order as Ordered by orderNumber
    @Transactional
    public PurchaseOrderGroupDto markOrderByOrderNumberAsOrdered(String orderNumber, String adminUsername, Long orgId) {
        if (orderNumber == null || orderNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order number cannot be blank");
        }

        List<PurchaseOrder> lines = (orgId != null)
            ? orderRepo.findByOrganisationIdAndPoNumberIgnoreCaseOrderByCreatedAtAsc(orgId, orderNumber.trim())
            : orderRepo.findByPoNumberIgnoreCaseOrderByCreatedAtAsc(orderNumber.trim());

        if (lines.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No purchase order found for " + orderNumber);
        }

        LocalDateTime now = LocalDateTime.now();
        String user = adminUsername != null ? adminUsername : "Organisation Admin";

        // Update header if exists
        Optional<PurchaseOrderHeader> headerOpt = (orgId != null)
            ? headerRepo.findByOrganisationIdAndOrderNumberIgnoreCase(orgId, orderNumber.trim())
            : headerRepo.findByOrderNumberIgnoreCase(orderNumber.trim());

        headerOpt.ifPresent(h -> {
            h.status = "ORDERED";
            h.orderedAt = now;
            h.orderedBy = user;
            headerRepo.save(h);
        });

        // Update all lines
        for (PurchaseOrder line : lines) {
            line.status = "ORDERED";
            line.orderedAt = now;
            line.orderedBy = user;
            orderRepo.save(line);
        }

        PurchaseOrder first = lines.get(0);
        PurchaseOrderGroupDto dto = new PurchaseOrderGroupDto(orderNumber.trim(), first.source, "ORDERED", first.orderDate, first.createdAt, user);
        dto.lines = lines;
        return dto;
    }

    // Store Manager Order Draft Management
    public String getOrderDraft(String username) {
        String key = (username != null && !username.isBlank()) ? username.trim().toLowerCase() : "store_manager";
        try {
            List<String> list = jdbcTemplate.query(
                "SELECT draft_json FROM store_order_draft WHERE username = ?",
                (rs, rowNum) -> rs.getString("draft_json"),
                key
            );
            return (list.isEmpty() || list.get(0) == null) ? "[]" : list.get(0);
        } catch (Exception e) {
            return "[]";
        }
    }

    public void saveOrderDraft(String username, String draftJson) {
        String key = (username != null && !username.isBlank()) ? username.trim().toLowerCase() : "store_manager";
        String content = (draftJson != null && !draftJson.isBlank()) ? draftJson.trim() : "[]";
        try {
            jdbcTemplate.update(
                "INSERT INTO store_order_draft (username, draft_json, updated_at) " +
                "VALUES (?, ?, CURRENT_TIMESTAMP) " +
                "ON CONFLICT (username) DO UPDATE SET draft_json = EXCLUDED.draft_json, updated_at = CURRENT_TIMESTAMP",
                key, content
            );
        } catch (Exception ignored) {}
    }

    public void clearOrderDraft(String username) {
        String key = (username != null && !username.isBlank()) ? username.trim().toLowerCase() : "store_manager";
        try {
            jdbcTemplate.update("DELETE FROM store_order_draft WHERE username = ?", key);
        } catch (Exception ignored) {}
    }
}
