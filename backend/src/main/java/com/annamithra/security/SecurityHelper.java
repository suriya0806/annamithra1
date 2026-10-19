package com.annamithra.security;

import com.annamithra.model.UserSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;

@Component
public class SecurityHelper {
    private final TokenService tokenService;

    public SecurityHelper(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    public UserSession requireUser(HttpServletRequest request) {
        String token = extractToken(request);
        if (token == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication token missing");
        }

        return tokenService.validateToken(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired session token"));
    }

    public UserSession requireRole(HttpServletRequest request, String... allowedRoles) {
        UserSession session = requireUser(request);
        boolean matched = Arrays.stream(allowedRoles)
            .anyMatch(r -> r.equalsIgnoreCase(session.role));
        if (!matched) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Requires role " + Arrays.toString(allowedRoles));
        }
        return session;
    }

    public UserSession requireBranchAccess(HttpServletRequest request, String branchName) {
        UserSession session = requireUser(request);
        if ("Branch Manager".equalsIgnoreCase(session.role)) {
            if (session.branchName == null || !session.branchName.equalsIgnoreCase(branchName.trim())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: You can only access records for " + session.branchName);
            }
        }
        return session;
    }

    public Long requireOrganisationId(UserSession session) {
        if ("Master Admin".equalsIgnoreCase(session.role)) {
            return null; // Master Admin has universal visibility
        }
        if (session.organisationId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: User is not associated with an organisation");
        }
        return session.organisationId;
    }

    public void validateOrganisationAccess(UserSession session, Long resourceOrgId) {
        if ("Master Admin".equalsIgnoreCase(session.role)) {
            return;
        }
        if (session.organisationId == null || !session.organisationId.equals(resourceOrgId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied: Cannot access data from another organisation");
        }
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        String customHeader = request.getHeader("X-Auth-Token");
        if (customHeader != null && !customHeader.isBlank()) {
            return customHeader.trim();
        }
        return null;
    }
}
