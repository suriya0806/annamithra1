package com.annamithra.repository;

import com.annamithra.model.Item;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface ItemRepository extends JpaRepository<Item, Long> {
    Optional<Item> findByNameIgnoreCase(String name);
    List<Item> findAllByOrderByNameAsc();
    List<Item> findByOrganisationIdOrderByNameAsc(Long organisationId);
    Optional<Item> findByOrganisationIdAndNameIgnoreCase(Long organisationId, String name);
    Optional<Item> findByOrganisationIdAndNameIgnoreCaseAndIdNot(Long organisationId, String name, Long id);
    Optional<Item> findByNameIgnoreCaseAndIdNot(String name, Long id);
    List<Item> findByOrganisationIdAndCategoryId(Long organisationId, Long categoryId);
    List<Item> findByCategoryId(Long categoryId);
    List<Item> findByOrganisationIdAndCategoryIgnoreCase(Long organisationId, String category);
    int countByOrganisationId(Long organisationId);
    long countByOrganisationIdAndCategoryId(Long organisationId, Long categoryId);
    long countByCategoryId(Long categoryId);
}
