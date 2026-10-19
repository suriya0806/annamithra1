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
    int countByOrganisationId(Long organisationId);
}
