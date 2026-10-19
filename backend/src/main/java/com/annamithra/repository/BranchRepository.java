package com.annamithra.repository;

import com.annamithra.model.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface BranchRepository extends JpaRepository<Branch, Long> {
    Optional<Branch> findByNameIgnoreCase(String name);
    List<Branch> findAllByOrderByIdAsc();
    List<Branch> findByOrganisationIdOrderByIdAsc(Long organisationId);
    Optional<Branch> findByOrganisationIdAndNameIgnoreCase(Long organisationId, String name);
    int countByOrganisationId(Long organisationId);
}
