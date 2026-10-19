package com.annamithra.repository;

import com.annamithra.model.PurchaseReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, Long> {
    List<PurchaseReceipt> findByPurchaseOrderIdOrderByReceiptDateDesc(Long purchaseOrderId);
    List<PurchaseReceipt> findByPurchaseOrderIdInOrderByReceiptDateDesc(List<Long> purchaseOrderIds);
    List<PurchaseReceipt> findAllByOrderByReceiptDateDesc();
    List<PurchaseReceipt> findByOrganisationIdOrderByReceiptDateDesc(Long organisationId);
}
