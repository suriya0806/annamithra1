package com.annamithra.controller;

import com.annamithra.dto.BranchOrderDraftDto.*;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.BranchOrderDraftService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/branch-drafts")
@CrossOrigin
public class BranchOrderDraftController {
    private final BranchOrderDraftService draftService;
    private final SecurityHelper security;

    public BranchOrderDraftController(BranchOrderDraftService draftService, SecurityHelper security) {
        this.draftService = draftService;
        this.security = security;
    }

    // Branch Manager & Org Admin: Save current order list as draft
    @PostMapping
    public DraftResponse createDraft(
            @RequestBody SaveDraftRequest req,
            @RequestParam(required = false) String branch,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        String targetBranch = (user.branchName != null && !user.branchName.isBlank()) ? user.branchName : branch;
        return draftService.createDraft(req, targetBranch, user.branchId, orgId, user.username);
    }

    // Branch Manager: Get all saved drafts for own authorised branch
    @GetMapping
    public List<DraftResponse> getDrafts(
            @RequestParam(required = false) String branch,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        String targetBranch = (user.branchName != null && !user.branchName.isBlank()) ? user.branchName : branch;
        return draftService.getDraftsByBranch(targetBranch, orgId);
    }

    // Branch Manager: Get specific draft details
    @GetMapping("/{id}")
    public DraftResponse getDraftById(
            @PathVariable Long id,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return draftService.getDraftById(id, user.branchName, orgId);
    }

    // Branch Manager: Update an existing draft
    @PutMapping("/{id}")
    public DraftResponse updateDraft(
            @PathVariable Long id,
            @RequestBody SaveDraftRequest req,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return draftService.updateDraft(id, req, user.branchName, orgId, user.username);
    }

    // Branch Manager: Delete a draft with confirmation
    @DeleteMapping("/{id}")
    public Map<String, Object> deleteDraft(
            @PathVariable Long id,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        draftService.deleteDraft(id, user.branchName, orgId);
        return Map.of("status", "success", "message", "Draft deleted successfully", "id", id);
    }

    // Branch Manager: Mark draft as moved to order list
    @PostMapping("/{id}/move")
    public DraftResponse markMovedToOrder(
            @PathVariable Long id,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return draftService.markMovedToOrder(id, user.branchName, orgId);
    }
}
