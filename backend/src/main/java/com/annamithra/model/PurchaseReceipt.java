package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_receipt")
public class PurchaseReceipt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false)
    public Long purchaseOrderId;

    @Column(nullable = false)
    public String itemName;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public double receivedQty;

    public LocalDateTime receiptDate = LocalDateTime.now();
    public String receivedBy;

    public PurchaseReceipt() {}

    public PurchaseReceipt(Long purchaseOrderId, String itemName, String unit, double receivedQty, String receivedBy) {
        this.purchaseOrderId = purchaseOrderId;
        this.itemName = itemName;
        this.unit = unit;
        this.receivedQty = receivedQty;
        this.receivedBy = receivedBy;
    }

    public PurchaseReceipt(Long organisationId, Long purchaseOrderId, String itemName, String unit, double receivedQty, String receivedBy) {
        this.organisationId = organisationId;
        this.purchaseOrderId = purchaseOrderId;
        this.itemName = itemName;
        this.unit = unit;
        this.receivedQty = receivedQty;
        this.receivedBy = receivedBy;
    }
}
