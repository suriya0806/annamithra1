package com.annamithra.controller;

import com.annamithra.dto.AcknowledgeDispatchRequest;
import com.annamithra.dto.PrepareDispatchRequest;
import com.annamithra.dto.ReturnDispatchRequest;
import com.annamithra.model.Dispatch;
import com.annamithra.model.DispatchReturn;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.DispatchService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/dispatches")
@CrossOrigin
public class DispatchController {
    private final DispatchService dispatchService;
    private final SecurityHelper security;

    public DispatchController(DispatchService dispatchService, SecurityHelper security) {
        this.dispatchService = dispatchService;
        this.security = security;
    }

    // Store Manager: Multi-item dispatch to a branch
    @PostMapping("/prepare")
    public List<Dispatch> prepareAndDispatch(@RequestBody PrepareDispatchRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.prepareAndDispatch(req, user.username, orgId);
    }

    // Store Manager: Dispatch history with acknowledgement status
    @GetMapping("/history")
    public List<Dispatch> getStoreDispatchHistory(
            @RequestParam(required = false) String branch,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.getStoreDispatchHistory(branch, date, fromDate, toDate, search, orgId);
    }

    // Branch Manager: Deliveries sent to the logged-in manager's branch
    @GetMapping("/my-branch")
    public List<Dispatch> getBranchDeliveries(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.getBranchDeliveries(user.branchName, date, fromDate, toDate, orgId);
    }

    // Branch Manager: Acknowledge physical receipt of a delivery
    @PostMapping("/{id}/acknowledge")
    public Dispatch acknowledgeDispatch(
            @PathVariable Long id,
            @RequestBody(required = false) AcknowledgeDispatchRequest req,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        Integer receivedQty = (req != null) ? req.actualReceivedQty : null;
        String remarks = (req != null) ? req.remarks : null;
        return dispatchService.acknowledgeDispatch(id, receivedQty, remarks, user.branchName, user.username, orgId);
    }

    // Branch Manager: History of deliveries actually received by assigned branch
    @GetMapping("/my-branch/history")
    public List<Dispatch> getBranchReceivedHistory(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String search,
            HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.getBranchReceivedHistory(user.branchName, date, fromDate, toDate, search, orgId);
    }

    // Branch Manager: Return an item from a delivery
    @PostMapping("/{id}/return")
    public Dispatch returnDispatch(@PathVariable Long id, @RequestBody ReturnDispatchRequest req, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Return request body is required");
        }
        return dispatchService.returnDispatch(id, req.returnQty, req.reason, user.branchName, user.username, orgId);
    }

    // Branch Manager or Store Manager: View returns for a specific dispatch
    @GetMapping("/{id}/returns")
    public List<DispatchReturn> getReturnsForDispatch(@PathVariable Long id, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Branch Manager", "Store Manager", "Organisation Admin");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.getDispatchReturns(id, orgId);
    }

    // Store Manager or Organisation Admin: View all returns
    @GetMapping("/returns")
    public List<DispatchReturn> getAllReturns(@RequestParam(required = false) String branch, HttpServletRequest request) {
        UserSession user = security.requireRole(request, "Store Manager", "Organisation Admin", "Branch Manager");
        Long orgId = security.requireOrganisationId(user);
        return dispatchService.getAllReturns(branch, orgId);
    }
}
