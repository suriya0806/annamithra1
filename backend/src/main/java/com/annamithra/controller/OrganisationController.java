package com.annamithra.controller;

import com.annamithra.dto.*;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.OrganisationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organisation")
@CrossOrigin
public class OrganisationController {
    private final OrganisationService orgService;
    private final SecurityHelper security;

    public OrganisationController(OrganisationService orgService, SecurityHelper security) {
        this.orgService = orgService;
        this.security = security;
    }

    @GetMapping("/my-organisation")
    public OrganisationSummaryDto getMyOrganisation(HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.getOrganisationById(orgId);
    }

    @GetMapping("/store-manager")
    public StoreManagerAccountDto getStoreManager(HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.getStoreManager(orgId);
    }

    @PostMapping("/store-manager")
    public StoreManagerAccountDto createOrUpdateStoreManager(
            @RequestBody CreateStoreManagerRequest req,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.createOrUpdateStoreManager(orgId, req);
    }

    @GetMapping("/accounts")
    public List<OrganisationAccountDto> getOrganisationAccounts(HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.getOrganisationAccounts(orgId);
    }

    @PutMapping("/accounts/{userId}")
    public OrganisationAccountDto updateAccount(
            @PathVariable Long userId,
            @RequestBody UpdateAccountRequest req,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.updateAccount(orgId, userId, req, session.username);
    }

    @PostMapping("/branches/{branchId}/account")
    public OrganisationAccountDto assignOrCreateBranchManager(
            @PathVariable Long branchId,
            @RequestBody UpdateAccountRequest req,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return orgService.assignOrCreateBranchManager(orgId, branchId, req, session.username);
    }
}
