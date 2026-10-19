package com.annamithra.controller;

import com.annamithra.dto.CreateOrganisationRequest;
import com.annamithra.dto.OrganisationStatusRequest;
import com.annamithra.dto.OrganisationSummaryDto;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.OrganisationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class MasterAdminController {
    private final OrganisationService orgService;
    private final SecurityHelper security;

    public MasterAdminController(OrganisationService orgService, SecurityHelper security) {
        this.orgService = orgService;
        this.security = security;
    }

    @GetMapping("/organisations")
    public List<OrganisationSummaryDto> getOrganisations(
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        security.requireRole(request, "Master Admin");
        return orgService.getAllOrganisations(search);
    }

    @GetMapping("/organisations/{id}")
    public OrganisationSummaryDto getOrganisationById(
            @PathVariable Long id,
            HttpServletRequest request) {
        security.requireRole(request, "Master Admin");
        return orgService.getOrganisationById(id);
    }

    @PostMapping("/organisations")
    public ResponseEntity<OrganisationSummaryDto> createOrganisation(
            @RequestBody CreateOrganisationRequest req,
            HttpServletRequest request) {
        security.requireRole(request, "Master Admin");
        OrganisationSummaryDto created = orgService.createOrganisation(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/organisations/{id}/status")
    public OrganisationSummaryDto setOrganisationStatus(
            @PathVariable Long id,
            @RequestBody OrganisationStatusRequest req,
            HttpServletRequest request) {
        security.requireRole(request, "Master Admin");
        return orgService.setOrganisationStatus(id, req.status);
    }
}
