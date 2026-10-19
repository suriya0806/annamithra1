package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory_transaction")
public class InventoryTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false)
    public String itemName;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public String type; // "RECEIPT", "DISPATCH"

    @Column(nullable = false)
    public int quantity;

    public String referenceType; // "PURCHASE_RECEIPT", "DISPATCH"
    public Long referenceId;

    @Column(nullable = false)
    public int balanceAfter;

    public LocalDateTime transactionDate = LocalDateTime.now();
    public String performedBy;

    public InventoryTransaction() {}

    public InventoryTransaction(String itemName, String unit, String type, int quantity, String referenceType, Long referenceId, int balanceAfter, String performedBy) {
        this.itemName = itemName;
        this.unit = unit;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.balanceAfter = balanceAfter;
        this.performedBy = performedBy;
    }

    public InventoryTransaction(Long organisationId, String itemName, String unit, String type, int quantity, String referenceType, Long referenceId, int balanceAfter, String performedBy) {
        this.organisationId = organisationId;
        this.itemName = itemName;
        this.unit = unit;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.balanceAfter = balanceAfter;
        this.performedBy = performedBy;
    }
}
