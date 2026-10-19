package com.annamithra.controller;

import com.annamithra.dto.CreateItemRequest;
import com.annamithra.model.Item;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.InventoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/items")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class ItemController {
    private final InventoryService inventoryService;
    private final SecurityHelper security;

    public ItemController(InventoryService inventoryService, SecurityHelper security) {
        this.inventoryService = inventoryService;
        this.security = security;
    }

    @GetMapping
    public List<Item> getItems(HttpServletRequest request) {
        try {
            UserSession session = security.requireUser(request);
            if (session != null && session.organisationId != null) {
                return inventoryService.getAllItems(session.organisationId);
            }
        } catch (Exception ignored) {}
        return inventoryService.getAllItems();
    }

    @PostMapping
    public ResponseEntity<Item> createItem(@RequestBody CreateItemRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Branch Manager");
        String username = session != null ? session.username : "Branch Manager";
        Long orgId = session != null ? session.organisationId : null;
        Item created = inventoryService.createItem(req, orgId, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
