package com.annamithra.controller;

import com.annamithra.dto.BranchManagerMappingDto;
import com.annamithra.dto.CreateBranchRequest;
import com.annamithra.model.Branch;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.BranchService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/branches")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class BranchController {
    private final BranchService branchService;
    private final SecurityHelper security;

    public BranchController(BranchService branchService, SecurityHelper security) {
        this.branchService = branchService;
        this.security = security;
    }

    @GetMapping
    public List<Branch> getBranches(HttpServletRequest request) {
        try {
            UserSession session = security.requireUser(request);
            if ("Master Admin".equalsIgnoreCase(session.role)) {
                return branchService.getAllBranches();
            }
            if (session.organisationId != null) {
                return branchService.getBranchesByOrganisation(session.organisationId);
            }
        } catch (Exception ignored) {}
        return branchService.getAllBranches();
    }

    @PostMapping
    public Branch createBranch(@RequestBody CreateBranchRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        return branchService.createBranch(req, orgId);
    }

    @GetMapping("/managers")
    public List<BranchManagerMappingDto> getBranchManagerMappings(HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Organisation Admin", "Master Admin");
        Long orgId = session.organisationId;
        return branchService.getBranchManagerMappings(orgId);
    }
}
