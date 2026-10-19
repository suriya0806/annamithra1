package com.annamithra.repository;

import com.annamithra.model.PurchaseOrderHeader;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PurchaseOrderHeaderRepository extends JpaRepository<PurchaseOrderHeader, Long> {
    Optional<PurchaseOrderHeader> findByOrderNumberIgnoreCase(String orderNumber);
    Optional<PurchaseOrderHeader> findByOrganisationIdAndOrderNumberIgnoreCase(Long organisationId, String orderNumber);
    List<PurchaseOrderHeader> findAllByOrderByCreatedAtDesc();
    List<PurchaseOrderHeader> findByOrganisationIdOrderByCreatedAtDesc(Long organisationId);
    List<PurchaseOrderHeader> findBySourceOrderByCreatedAtDesc(String source);
    List<PurchaseOrderHeader> findByOrganisationIdAndSourceOrderByCreatedAtDesc(Long organisationId, String source);
}
