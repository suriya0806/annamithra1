package com.annamithra.controller;

import com.annamithra.dto.OrgNewItemOrderRequest;
import com.annamithra.dto.ReceivePoRequest;
import com.annamithra.dto.StoreOrderRequest;
import com.annamithra.model.PurchaseOrder;
import com.annamithra.model.PurchaseReceipt;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.PurchaseOrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/purchase-orders")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class PurchaseOrderController {
    private final PurchaseOrderService orderService;
    private final SecurityHelper security;

    public PurchaseOrderController(PurchaseOrderService orderService, SecurityHelper security) {
        this.orderService = orderService;
        this.security = security;
    }

    // Organisation Admin: Place order for new items
    @PostMapping("/new-items")
    public List<PurchaseOrder> createOrgNewItemsOrder(@RequestBody OrgNewItemOrderRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.createOrgNewItemsOrder(req, user.username, orgId);
    }

    // Organisation Admin: View placed new item orders
    @GetMapping("/org-new-items")
    public List<PurchaseOrder> getOrgNewItemOrders(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getOrgNewItemOrders(date, fromDate, toDate, search, orgId);
    }

    // Organisation Admin: View purchase requests submitted by Store Manager
    @GetMapping("/requested")
    public List<PurchaseOrder> getRequestedOrders(HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getStoreManagerRequestedOrders(orgId);
    }

    // Organisation Admin: Mark purchase order as Ordered after placing with supplier
    @PatchMapping("/{id}/ordered")
    public PurchaseOrder markOrderAsOrdered(@PathVariable Long id, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.markOrderAsOrdered(id, user.username, orgId);
    }

    // Organisation Admin: History report of all purchase orders
    @GetMapping("/history")
    public List<PurchaseOrder> getOrderHistory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin", "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getOrderHistory(date, fromDate, toDate, search, orgId);
    }

    // Store Manager: View all purchase orders sent to Organisation Admin
    @GetMapping("/store-view")
    public List<PurchaseOrder> getStoreManagerOrdersView(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getStoreManagerOrdersView(date, fromDate, toDate, search, orgId);
    }

    // Store Manager: Entry - POs marked Ordered available for receipt
    @GetMapping("/ordered-for-entry")
    public List<PurchaseOrder> getOrdersForReceiving(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getOrdersForReceiving(date, fromDate, toDate, orgId);
    }

    // Store Manager: Confirm actual receipt of goods
    @PostMapping("/{id}/receive")
    public PurchaseOrder receiveOrderGoods(@PathVariable Long id, @RequestBody ReceivePoRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return orderService.receiveOrderGoods(id, req.receivedQty, user.username, orgId);
    }

    // Store Manager & Org Admin: View receipt history for an order line
    @GetMapping("/{id}/receipts")
    public List<PurchaseReceipt> getOrderReceipts(@PathVariable Long id, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getReceiptsByPurchaseOrderId(id, orgId);
    }

    // Store Manager & Org Admin: View receipt history for an order number (e.g. ORDER11)
    @GetMapping("/by-order-number/{orderNumber}/receipts")
    public List<PurchaseReceipt> getReceiptsByOrderNumber(@PathVariable String orderNumber, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getReceiptsByOrderNumber(orderNumber, orgId);
    }

    // Store Manager: Consolidate requirements and send order to Organisation Admin
    @PostMapping("/store-order")
    public List<PurchaseOrder> createStoreManagerOrder(@RequestBody StoreOrderRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return orderService.createStoreManagerOrder(req, user.username, orgId);
    }

    // Store Manager: Get saved order draft
    @GetMapping(value = "/draft", produces = "application/json")
    public String getOrderDraft(HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        return orderService.getOrderDraft(user.username);
    }

    // Store Manager: Save order draft
    @PostMapping(value = "/draft", consumes = "application/json", produces = "application/json")
    public java.util.Map<String, Object> saveOrderDraft(@RequestBody String draftJson, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        orderService.saveOrderDraft(user.username, draftJson);
        return java.util.Map.of("status", "success", "message", "Draft saved");
    }

    // Store Manager: Clear order draft
    @DeleteMapping(value = "/draft", produces = "application/json")
    public java.util.Map<String, Object> clearOrderDraft(HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        orderService.clearOrderDraft(user.username);
        return java.util.Map.of("status", "success", "message", "Draft cleared");
    }

    // Store Manager: View purchase orders submitted today (Already Ordered Today)
    @GetMapping("/already-ordered-today")
    public List<com.annamithra.dto.PurchaseOrderGroupDto> getAlreadyOrderedToday(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getAlreadyOrderedToday(date, orgId);
    }

    // Store Manager: View list of previous purchase orders
    @GetMapping("/previous-orders")
    public List<com.annamithra.dto.PurchaseOrderGroupDto> getPreviousOrders(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getPreviousOrders(date, fromDate, toDate, orgId);
    }

    // View single purchase order line items by orderNumber (for View Order popup & Download PDF)
    @GetMapping("/by-order-number/{orderNumber}")
    public com.annamithra.dto.PurchaseOrderGroupDto getOrderByOrderNumber(@PathVariable String orderNumber, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getOrderByOrderNumber(orderNumber, orgId);
    }

    // Organisation Admin: View purchase requests grouped by order number
    @GetMapping("/requested-groups")
    public List<com.annamithra.dto.PurchaseOrderGroupDto> getRequestedOrdersGrouped(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.getRequestedOrdersGrouped(date, fromDate, toDate, orgId);
    }

    // Organisation Admin: Mark an entire purchase order as Ordered by orderNumber
    @PatchMapping("/by-order-number/{orderNumber}/ordered")
    public com.annamithra.dto.PurchaseOrderGroupDto markOrderByOrderNumberAsOrdered(@PathVariable String orderNumber, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return orderService.markOrderByOrderNumberAsOrdered(orderNumber, user.username, orgId);
    }
}
