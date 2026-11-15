package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "vendor_inventory_entry_item")
public class VendorInventoryEntryItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long entryId;

    @Column(nullable = false)
    public Long organisationId;

    @Column(nullable = false)
    public Long itemId;

    @Column(nullable = false)
    public String itemName;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public Double quantity;

    @Column(nullable = false)
    public Double stockBefore;

    @Column(nullable = false)
    public Double stockAfter;

    public Double unitRate = 0.0;
    public Double totalRate = 0.0;

    public Long transactionId;
    public LocalDateTime createdAt = LocalDateTime.now();

    public VendorInventoryEntryItem() {}

    public VendorInventoryEntryItem(Long entryId, Long organisationId, Long itemId, String itemName,
                                    String unit, Double quantity, Double stockBefore, Double stockAfter,
                                    Double unitRate, Double totalRate, Long transactionId) {
        this.entryId = entryId;
        this.organisationId = organisationId;
        this.itemId = itemId;
        this.itemName = itemName;
        this.unit = unit;
        this.quantity = quantity;
        this.stockBefore = stockBefore;
        this.stockAfter = stockAfter;
        this.unitRate = unitRate != null ? unitRate : 0.0;
        this.totalRate = totalRate != null ? totalRate : 0.0;
        this.transactionId = transactionId;
        this.createdAt = LocalDateTime.now();
    }

    public VendorInventoryEntryItem(Long entryId, Long organisationId, Long itemId, String itemName,
                                    String unit, Double quantity, Double stockBefore, Double stockAfter,
                                    Long transactionId) {
        this(entryId, organisationId, itemId, itemName, unit, quantity, stockBefore, stockAfter, 0.0, 0.0, transactionId);
    }
}

