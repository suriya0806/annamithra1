package com.annamithra.repository;

import com.annamithra.model.Item;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Item i WHERE i.id = :id AND i.organisationId = :organisationId")
    Optional<Item> findByIdAndOrganisationIdForUpdate(@Param("id") Long id, @Param("organisationId") Long organisationId);
}
