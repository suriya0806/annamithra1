package com.annamithra.controller;

import com.annamithra.dto.CreateVendorRequest;
import com.annamithra.dto.VendorEntryDto;
import com.annamithra.dto.VendorEntryReportDto;
import com.annamithra.dto.VendorEntryRequest;
import com.annamithra.model.UserSession;
import com.annamithra.model.Vendor;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.VendorEntryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@CrossOrigin
public class VendorEntryController {

    private final VendorEntryService vendorEntryService;
    private final SecurityHelper security;

    public VendorEntryController(VendorEntryService vendorEntryService, SecurityHelper security) {
        this.vendorEntryService = vendorEntryService;
        this.security = security;
    }

    // -------------------------------------------------------------
    // VENDOR ENDPOINTS
    // -------------------------------------------------------------

    @GetMapping("/api/vendors")
    public List<Vendor> getVendors(@RequestParam(required = false) String search, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(session);
        return vendorEntryService.getVendors(orgId, search);
    }

    @PostMapping("/api/vendors")
    public ResponseEntity<Vendor> createVendor(@RequestBody CreateVendorRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        String username = session != null ? session.username : "Store Manager";
        Vendor created = vendorEntryService.createVendor(orgId, req, username);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // -------------------------------------------------------------
    // VENDOR ENTRY ENDPOINTS
    // -------------------------------------------------------------

    @PostMapping("/api/vendor-entries")
    public ResponseEntity<VendorEntryDto> saveVendorEntry(@RequestBody VendorEntryRequest req, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(session);
        String username = session != null ? session.username : "Store Manager";
        Long userId = session != null ? session.userId : null;

        VendorEntryDto result = vendorEntryService.saveVendorEntry(orgId, req, username, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/api/vendor-entries")
    public List<VendorEntryDto> getVendorEntries(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(session);
        return vendorEntryService.getVendorEntries(orgId, fromDate, toDate, search);
    }

    @GetMapping("/api/vendor-entries/report")
    public VendorEntryReportDto getVendorEntryReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(session);
        return vendorEntryService.getVendorEntryReport(orgId, fromDate, toDate, search);
    }

    @GetMapping("/api/vendor-entries/{id}")
    public VendorEntryDto getEntryDetails(@PathVariable Long id, HttpServletRequest request) {
        UserSession session = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(session);
        return vendorEntryService.getEntryDetails(orgId, id);
    }
}

