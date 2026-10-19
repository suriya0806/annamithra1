package com.annamithra.repository;

import com.annamithra.model.InventoryTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {
    List<InventoryTransaction> findAllByOrderByTransactionDateDesc();
    List<InventoryTransaction> findByOrganisationIdOrderByTransactionDateDesc(Long organisationId);
    List<InventoryTransaction> findByItemNameIgnoreCaseOrderByTransactionDateDesc(String itemName);
    List<InventoryTransaction> findByOrganisationIdAndItemNameIgnoreCaseOrderByTransactionDateDesc(Long organisationId, String itemName);
}
