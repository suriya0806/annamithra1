package com.annamithra.controller;

import com.annamithra.dto.BranchRequestDateSectionDto;
import com.annamithra.dto.BranchRequestHistoryDto;
import com.annamithra.dto.ConsolidatedItemDto;
import com.annamithra.dto.MultiItemBranchRequest;
import com.annamithra.model.BranchRequest;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.BranchRequestService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/branch-requests")
@CrossOrigin
public class BranchRequestController {
    private final BranchRequestService requestService;
    private final SecurityHelper security;

    public BranchRequestController(BranchRequestService requestService, SecurityHelper security) {
        this.requestService = requestService;
        this.security = security;
    }

    // Branch Manager: Submit multi-item request for assigned branch
    @PostMapping
    public List<BranchRequest> submitBranchRequest(@RequestBody MultiItemBranchRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        return requestService.submitBranchRequest(req, user.branchName, user.branchId, orgId);
    }

    // Branch Manager: View own branch requests
    @GetMapping("/my-branch")
    public List<BranchRequest> getMyBranchRequests(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        return requestService.getRequestsByBranch(user.branchName, date, fromDate, toDate, orgId);
    }

    // Store Manager & Org Admin: View date-wise aggregated requests by branch and optional date
    @GetMapping
    public List<BranchRequestDateSectionDto> getRequests(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String date,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        LocalDate parsedDate = null;
        if (date != null && !date.isBlank()) {
            try {
                parsedDate = LocalDate.parse(date.trim());
            } catch (Exception e) {
                // Ignore parse errors and return empty or unfiltered as appropriate
            }
        }
        return requestService.getDateWiseAggregatedRequests(branch, parsedDate, orgId);
    }

    // History for a specific aggregated row
    @GetMapping("/history")
    public List<BranchRequestHistoryDto> getRequestHistory(
            @RequestParam String branch,
            @RequestParam String date,
            @RequestParam String item,
            @RequestParam(required = false) String unit,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return requestService.getRequestHistory(branch, LocalDate.parse(date), item, unit, orgId);
    }

    // View raw individual requests if needed
    @GetMapping("/raw")
    public List<BranchRequest> getRawRequests(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return requestService.getRequestsByBranch(branch, date, fromDate, toDate, orgId);
    }

    // Store Manager: View outstanding requests for a branch (to prepare dispatch)
    @GetMapping("/outstanding")
    public List<BranchRequest> getOutstandingRequests(
            @RequestParam String branch,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return requestService.getOutstandingRequestsForBranch(branch, date, orgId);
    }

    // Store Manager: Consolidated requirements across all branches
    @GetMapping("/consolidated")
    public List<ConsolidatedItemDto> getConsolidatedRequirements(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return requestService.getConsolidatedRequirements(date, orgId);
    }
}
