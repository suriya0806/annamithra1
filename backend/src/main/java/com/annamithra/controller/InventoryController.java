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
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

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
    public List<Item> getCentralInventory(
            @RequestParam(required = false) Long organisationId,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long effectiveOrgId = session.organisationId;
        if ("Master Admin".equalsIgnoreCase(session.role) && organisationId != null) {
            effectiveOrgId = organisationId;
        } else if (!"Master Admin".equalsIgnoreCase(session.role) && organisationId != null && !organisationId.equals(session.organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot view another organisation's inventory");
        }
        return inventoryService.getCentralInventory(effectiveOrgId);
    }

    @GetMapping({"/transactions", "/entries"})
    public List<InventoryTransaction> getTransactions(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String item,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Long organisationId,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long effectiveOrgId = session.organisationId;
        if ("Master Admin".equalsIgnoreCase(session.role) && organisationId != null) {
            effectiveOrgId = organisationId;
        } else if (!"Master Admin".equalsIgnoreCase(session.role) && organisationId != null && !organisationId.equals(session.organisationId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot view another organisation's inventory");
        }
        return inventoryService.getTransactions(effectiveOrgId, date, fromDate, toDate, item, category);
    }

    @PostMapping("/receive")
    public GoodsReceiptResponseDto receiveGoods(@RequestBody DirectReceiptRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(session);
        String username = session != null ? session.username : "Store Manager";
        return inventoryService.recordGoodsReceipt(req, orgId, username);
    }

    @PostMapping({"/add-direct-stock", "/entry"})
    public DirectStockResponseDto addDirectStock(@RequestBody DirectStockRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        Long adminId = session != null ? session.userId : null;

        // Security check: reject if client attempts to manipulate organisationId or adminId
        if (req.organisationId != null && !req.organisationId.equals(orgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot modify another organisation's inventory");
        }
        if (req.adminId != null && !req.adminId.equals(adminId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot spoof admin identity");
        }

        String username = session != null ? session.username : "Organisation Admin";
        return inventoryService.addDirectStock(req, orgId, username, adminId);
    }
}
