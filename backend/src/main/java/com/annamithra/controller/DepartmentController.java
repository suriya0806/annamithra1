package com.annamithra.controller;

import com.annamithra.model.Department;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.DepartmentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/departments")
@CrossOrigin(origins = "*")
public class DepartmentController {

    private final DepartmentService departmentService;
    private final SecurityHelper securityHelper;

    public DepartmentController(DepartmentService departmentService, SecurityHelper securityHelper) {
        this.departmentService = departmentService;
        this.securityHelper = securityHelper;
    }

    @GetMapping
    public ResponseEntity<List<Department>> getDepartments(HttpServletRequest request) {
        UserSession session = securityHelper.requireUser(request);
        Long orgId = session.organisationId != null ? session.organisationId : 1L;
        List<Department> departments = departmentService.getDepartments(orgId);
        return ResponseEntity.ok(departments);
    }
}

