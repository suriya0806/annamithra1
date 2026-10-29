package com.annamithra.controller;

import com.annamithra.dto.CreateCategoryRequest;
import com.annamithra.dto.UpdateCategoryRequest;
import com.annamithra.model.ItemCategory;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.CategoryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/categories")
@CrossOrigin
public class CategoryController {
    private final CategoryService categoryService;
    private final SecurityHelper security;

    public CategoryController(CategoryService categoryService, SecurityHelper security) {
        this.categoryService = categoryService;
        this.security = security;
    }

    @GetMapping
    public List<ItemCategory> getCategories(
            @RequestParam(required = false, defaultValue = "false") boolean includeInactive,
            @RequestParam(required = false) Long organisationId,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        if (session != null) {
            if ("Master Admin".equalsIgnoreCase(session.role)) {
                if (organisationId != null) {
                    return categoryService.getCategories(organisationId, includeInactive);
                }
                return categoryService.getCategories(null, includeInactive);
            }
            if (session.organisationId != null) {
                if (organisationId != null && !organisationId.equals(session.organisationId)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot view another organisation's categories");
                }
                return categoryService.getCategories(session.organisationId, includeInactive);
            }
        }
        return categoryService.getCategories(null, includeInactive);
    }

    @PostMapping
    public ResponseEntity<ItemCategory> createCategory(@RequestBody CreateCategoryRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        String username = session != null ? session.username : "Organisation Admin";
        Long orgId = session != null ? session.organisationId : null;

        if (req != null && req.organisationId != null && !req.organisationId.equals(orgId) && session != null && !"Master Admin".equalsIgnoreCase(session.role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: cannot create category for another organisation");
        }

        ItemCategory created = categoryService.createCategory(req, orgId, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ItemCategory updateCategory(@PathVariable Long id, @RequestBody UpdateCategoryRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        String username = session != null ? session.username : "Organisation Admin";
        Long orgId = session != null ? session.organisationId : null;
        return categoryService.updateCategory(id, req, orgId, username);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteCategory(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "false") boolean force,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = session != null ? session.organisationId : null;
        boolean deactivated = categoryService.deleteCategory(id, orgId, force);
        return ResponseEntity.ok(Map.of(
            "message", deactivated ? "Category deactivated because it is in use" : "Category removed successfully",
            "action", deactivated ? "deactivated" : "deleted",
            "active", !deactivated
        ));
    }
}
