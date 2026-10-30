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

    public String category;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public String type; // "RECEIPT", "DISPATCH"

    @Column(nullable = false)
    public double quantity;

    public String referenceType; // "PURCHASE_RECEIPT", "DISPATCH", "DIRECT_STOCK_ENTRY"
    public Long referenceId;

    @Column(nullable = false)
    public double balanceAfter;

    public LocalDateTime transactionDate = LocalDateTime.now();
    public String performedBy;
    public Long createdByAdminId;

    public InventoryTransaction() {}

    public InventoryTransaction(String itemName, String unit, String type, double quantity, String referenceType, Long referenceId, double balanceAfter, String performedBy) {
        this.itemName = itemName;
        this.unit = unit;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.balanceAfter = balanceAfter;
        this.performedBy = performedBy;
    }

    public InventoryTransaction(Long organisationId, String itemName, String unit, String type, double quantity, String referenceType, Long referenceId, double balanceAfter, String performedBy) {
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

    public InventoryTransaction(Long organisationId, String itemName, String category, String unit, String type, double quantity, String referenceType, Long referenceId, double balanceAfter, String performedBy, Long createdByAdminId) {
        this.organisationId = organisationId;
        this.itemName = itemName;
        this.category = category;
        this.unit = unit;
        this.type = type;
        this.quantity = quantity;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.balanceAfter = balanceAfter;
        this.performedBy = performedBy;
        this.createdByAdminId = createdByAdminId;
    }
}
