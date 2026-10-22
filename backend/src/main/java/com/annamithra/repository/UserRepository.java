package com.annamithra.repository;

import com.annamithra.model.AppUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);
    List<AppUser> findByRole(String role);
    List<AppUser> findByOrganisationId(Long organisationId);
    Optional<AppUser> findFirstByOrganisationIdAndRoleIgnoreCase(Long organisationId, String role);
    Optional<AppUser> findByIdAndOrganisationId(Long id, Long organisationId);
    List<AppUser> findByOrganisationIdOrderByRoleAscUsernameAsc(Long organisationId);
    int countByOrganisationId(Long organisationId);
}
