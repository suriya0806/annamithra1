package com.annamithra.repository;

import com.annamithra.model.ItemCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ItemCategoryRepository extends JpaRepository<ItemCategory, Long> {
    List<ItemCategory> findByOrganisationIdAndActiveTrueOrderByNameAsc(Long organisationId);
    List<ItemCategory> findByOrganisationIdOrderByNameAsc(Long organisationId);
    List<ItemCategory> findAllByActiveTrueOrderByNameAsc();
    List<ItemCategory> findAllByOrderByNameAsc();
    Optional<ItemCategory> findByOrganisationIdAndNameIgnoreCase(Long organisationId, String name);
    Optional<ItemCategory> findByNameIgnoreCase(String name);
    Optional<ItemCategory> findByOrganisationIdAndNameIgnoreCaseAndIdNot(Long organisationId, String name, Long id);
}

