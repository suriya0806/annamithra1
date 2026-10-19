package com.annamithra.service;

import com.annamithra.dto.LoginRequest;
import com.annamithra.dto.LoginResponse;
import com.annamithra.model.AppUser;
import com.annamithra.model.Organisation;
import com.annamithra.model.UserSession;
import com.annamithra.repository.OrganisationRepository;
import com.annamithra.repository.UserRepository;
import com.annamithra.security.PasswordUtils;
import com.annamithra.security.TokenService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
    private final UserRepository userRepo;
    private final OrganisationRepository orgRepo;
    private final TokenService tokenService;

    public AuthService(UserRepository userRepo, OrganisationRepository orgRepo, TokenService tokenService) {
        this.userRepo = userRepo;
        this.orgRepo = orgRepo;
        this.tokenService = tokenService;
    }

    public LoginResponse login(LoginRequest req) {
        if (req.username == null || req.username.isBlank() || req.password == null || req.password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username and password are required");
        }

        AppUser user = userRepo.findByUsernameIgnoreCase(req.username.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        if (!PasswordUtils.verifyPassword(req.password, user.passwordHash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }

        // Validate selected role if provided
        if (req.role != null && !req.role.isBlank()) {
            String expectedRole = req.role.trim();
            if (!user.role.equalsIgnoreCase(expectedRole)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account does not have the " + expectedRole + " role");
            }
        }

        String orgName = null;
        String orgCode = null;
        if (user.organisationId != null) {
            Organisation org = orgRepo.findById(user.organisationId).orElse(null);
            if (org != null) {
                if ("INACTIVE".equalsIgnoreCase(org.status)) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Organisation account is deactivated. Please contact Master Admin.");
                }
                orgName = org.name;
                orgCode = org.code;
            }
        }

        UserSession session = tokenService.createSession(user);

        return new LoginResponse(
            session.token,
            user.id,
            user.username,
            user.role,
            user.organisationId,
            orgName,
            orgCode,
            user.branchId,
            user.branchName,
            user.fullName != null ? user.fullName : user.username
        );
    }
}
