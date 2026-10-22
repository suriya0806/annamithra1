package com.annamithra.controller;

import com.annamithra.dto.*;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.ReportService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
@CrossOrigin
public class ReportController {

    private final ReportService reportService;
    private final SecurityHelper security;

    public ReportController(ReportService reportService, SecurityHelper security) {
        this.reportService = reportService;
        this.security = security;
    }

    @GetMapping("/summary")
    public ReportSummaryDto getSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getSummary(fromDate, toDate, orgId);
    }

    @GetMapping("/central-inventory")
    public List<CentralInventoryReportDto> getCentralInventoryReport(
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getCentralInventoryReport(search, orgId);
    }

    @GetMapping("/purchase-orders")
    public List<PurchaseOrderReportDto> getPurchaseOrderReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getPurchaseOrderReport(date, fromDate, toDate, search, status, orgId);
    }

    @GetMapping("/inventory-entries")
    public List<InventoryEntryReportDto> getInventoryEntryReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getInventoryEntryReport(date, fromDate, toDate, search, orgId);
    }

    @GetMapping("/branch-requests")
    public List<BranchRequestReportDto> getBranchRequestReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getBranchRequestReport(fromDate, toDate, branch, search, status, category, orgId);
    }

    @GetMapping("/dispatches")
    public List<BranchDispatchReportDto> getBranchDispatchReport(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String category,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin", "Master Admin");
        Long orgId = security.requireOrganisationId(user);
        return reportService.getBranchDispatchReport(date, fromDate, toDate, branch, search, status, category, orgId);
    }
}
