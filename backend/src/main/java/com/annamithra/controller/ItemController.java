package com.annamithra.controller;

import com.annamithra.dto.CreateItemRequest;
import com.annamithra.dto.UpdateItemRequest;
import com.annamithra.model.Item;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/items")
@CrossOrigin
public class ItemController {
    private final InventoryService inventoryService;
    private final SecurityHelper security;

    public ItemController(InventoryService inventoryService, SecurityHelper security) {
        this.inventoryService = inventoryService;
        this.security = security;
    }

    @GetMapping
    public List<Item> getItems(@RequestParam(required = false) Long organisationId, HttpServletRequest request) {
        try {
            UserSession session = security.requireUser(request);
            if (session != null) {
                if ("Master Admin".equalsIgnoreCase(session.role)) {
                    if (organisationId != null) {
                        return inventoryService.getAllItems(organisationId);
                    }
                    return inventoryService.getAllItems();
                }
                if (session.organisationId != null) {
                    if (organisationId != null && !organisationId.equals(session.organisationId)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot view another organisation's items");
                    }
                    return inventoryService.getAllItems(session.organisationId);
                }
            }
        } catch (ResponseStatusException rse) {
            if (rse.getStatusCode() == HttpStatus.FORBIDDEN) {
                throw rse;
            }
        } catch (Exception ignored) {}
        return inventoryService.getAllItems();
    }

    @PostMapping
    public ResponseEntity<Item> createItem(@RequestBody CreateItemRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Branch Manager");
        String username = session != null ? session.username : "Branch Manager";
        Long orgId = session != null ? session.organisationId : null;

        if (req != null && req.organisationId != null && !req.organisationId.equals(orgId) && session != null && !"Master Admin".equalsIgnoreCase(session.role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot create items for another organisation");
        }

        Item created = inventoryService.createItem(req, orgId, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Item> updateItem(@PathVariable Long id, @RequestBody UpdateItemRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        String username = session != null ? session.username : "Organisation Admin";
        Long orgId = session != null ? session.organisationId : null;

        Item updated = inventoryService.updateItem(id, req, orgId, username);
        return ResponseEntity.ok(updated);
    }
}
