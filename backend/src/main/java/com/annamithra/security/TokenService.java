package com.annamithra.security;

import com.annamithra.model.AppUser;
import com.annamithra.model.UserSession;
import com.annamithra.repository.UserSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class TokenService {
    private final UserSessionRepository sessionRepo;
    private final SecureRandom random = new SecureRandom();

    public TokenService(UserSessionRepository sessionRepo) {
        this.sessionRepo = sessionRepo;
    }

    @Transactional
    public UserSession createSession(AppUser user) {
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        String token = HexFormat.of().formatHex(tokenBytes);

        UserSession session = new UserSession(
            token,
            user.id,
            user.username,
            user.role,
            user.organisationId,
            user.branchId,
            user.branchName,
            LocalDateTime.now().plusDays(7)
        );
        return sessionRepo.save(session);
    }

    public Optional<UserSession> validateToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return sessionRepo.findByToken(token)
            .filter(s -> s.expiresAt == null || s.expiresAt.isAfter(LocalDateTime.now()));
    }

    @Transactional
    public void invalidateToken(String token) {
        if (token != null) {
            sessionRepo.deleteByToken(token);
        }
    }
}
