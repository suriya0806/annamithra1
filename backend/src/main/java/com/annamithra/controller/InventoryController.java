package com.annamithra.controller;

import com.annamithra.dto.DirectReceiptRequest;
import com.annamithra.dto.DirectStockRequest;
import com.annamithra.dto.DirectStockResponseDto;
import com.annamithra.dto.GoodsReceiptResponseDto;
import com.annamithra.model.InventoryTransaction;
import com.annamithra.model.Item;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin
public class InventoryController {
    private final InventoryService inventoryService;
    private final SecurityHelper security;

    public InventoryController(InventoryService inventoryService, SecurityHelper security) {
        this.inventoryService = inventoryService;
        this.security = security;
    }

    @GetMapping
    public List<Item> getCentralInventory(HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        return inventoryService.getCentralInventory(session.organisationId);
    }

    @GetMapping("/transactions")
    public List<InventoryTransaction> getTransactions(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String item,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        return inventoryService.getTransactions(session.organisationId, date, fromDate, toDate, item);
    }

    @PostMapping("/receive")
    public GoodsReceiptResponseDto receiveGoods(@RequestBody DirectReceiptRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(session);
        String username = session != null ? session.username : "Store Manager";
        return inventoryService.recordGoodsReceipt(req, orgId, username);
    }

    @PostMapping("/add-direct-stock")
    public DirectStockResponseDto addDirectStock(@RequestBody DirectStockRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        String username = session != null ? session.username : "Store Manager";
        return inventoryService.addDirectStock(req, orgId, username);
    }
}
