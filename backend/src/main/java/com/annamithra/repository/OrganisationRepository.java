package com.annamithra.repository;

import com.annamithra.model.Organisation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface OrganisationRepository extends JpaRepository<Organisation, Long> {
    Optional<Organisation> findByCodeIgnoreCase(String code);
    List<Organisation> findAllByOrderByIdAsc();
    List<Organisation> findByNameContainingIgnoreCaseOrCodeContainingIgnoreCaseOrderByIdAsc(String name, String code);
}
