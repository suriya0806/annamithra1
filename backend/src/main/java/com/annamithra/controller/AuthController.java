package com.annamithra.controller;

import com.annamithra.dto.LoginRequest;
import com.annamithra.dto.LoginResponse;
import com.annamithra.model.UserSession;
import com.annamithra.security.SecurityHelper;
import com.annamithra.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin
public class AuthController {
    private final AuthService authService;
    private final SecurityHelper security;

    public AuthController(AuthService authService, SecurityHelper security) {
        this.authService = authService;
        this.security = security;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser(HttpServletRequest request) {
        UserSession session = security.requireUser(request);
        return Map.of(
            "id", session.userId != null ? session.userId : 0L,
            "username", session.username,
            "role", session.role,
            "branchId", session.branchId != null ? session.branchId : 0L,
            "branchName", session.branchName != null ? session.branchName : ""
        );
    }
}
