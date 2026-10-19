package com.annamithra.repository;

import com.annamithra.model.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    List<PurchaseOrder> findAllByOrderByCreatedAtDesc();
    List<PurchaseOrder> findByOrganisationIdOrderByCreatedAtDesc(Long organisationId);

    List<PurchaseOrder> findBySourceOrderByCreatedAtDesc(String source);
    List<PurchaseOrder> findByOrganisationIdAndSourceOrderByCreatedAtDesc(Long organisationId, String source);

    List<PurchaseOrder> findByPoNumberIgnoreCaseOrderByCreatedAtAsc(String poNumber);
    List<PurchaseOrder> findByOrganisationIdAndPoNumberIgnoreCaseOrderByCreatedAtAsc(Long organisationId, String poNumber);

    @Query("SELECT po FROM PurchaseOrder po WHERE po.source = 'STORE_MANAGER' ORDER BY po.createdAt DESC")
    List<PurchaseOrder> findStoreManagerRequests();

    @Query("SELECT po FROM PurchaseOrder po WHERE po.organisationId = :orgId AND po.source = 'STORE_MANAGER' ORDER BY po.createdAt DESC")
    List<PurchaseOrder> findStoreManagerRequestsByOrganisationId(Long orgId);

    @Query("SELECT po FROM PurchaseOrder po WHERE UPPER(po.status) IN ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED') ORDER BY po.createdAt DESC")
    List<PurchaseOrder> findOrderedForReceiving();

    @Query("SELECT po FROM PurchaseOrder po WHERE po.organisationId = :orgId AND UPPER(po.status) IN ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED') ORDER BY po.createdAt DESC")
    List<PurchaseOrder> findOrderedForReceivingByOrganisationId(Long orgId);

    List<PurchaseOrder> findByItemIgnoreCaseOrderByCreatedAtAsc(String item);
    List<PurchaseOrder> findByOrganisationIdAndItemIgnoreCaseOrderByCreatedAtAsc(Long organisationId, String item);

    @Query("SELECT po FROM PurchaseOrder po WHERE (:date IS NULL OR po.orderDate = :date) AND (:item IS NULL OR LOWER(po.item) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY po.createdAt DESC")
    List<PurchaseOrder> searchHistory(LocalDate date, String item);

    @Query("SELECT po FROM PurchaseOrder po WHERE po.organisationId = :orgId AND (:date IS NULL OR po.orderDate = :date) AND (:item IS NULL OR LOWER(po.item) LIKE LOWER(CONCAT('%', :item, '%'))) ORDER BY po.createdAt DESC")
    List<PurchaseOrder> searchHistoryByOrganisationId(Long orgId, LocalDate date, String item);

    int countByOrganisationId(Long organisationId);
}
