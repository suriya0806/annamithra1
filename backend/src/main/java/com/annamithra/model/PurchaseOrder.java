package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_order")
public class PurchaseOrder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;
    public String poNumber;
    public Long headerId;
    public LocalDate orderDate = LocalDate.now();
    public LocalDate requestDate;
    public LocalDateTime createdAt = LocalDateTime.now();

    public String source; // "STORE_MANAGER" or "ORGANISATION_ADMIN"

    @Column(nullable = false)
    public String item;

    @Column(nullable = false)
    public String unit;

    public double requiredQuantity = 0.0; // Preserved total required quantity from branches

    @Column(nullable = false)
    public double quantity; // Order quantity

    @Column(nullable = false)
    public double receivedQty = 0.0; // Cumulative actual received quantity

    @Column(nullable = false)
    public String status = "PENDING"; // PENDING, ORDERED, PARTIALLY_RECEIVED, RECEIVED

    public LocalDateTime orderedAt;
    public String orderedBy;

    public PurchaseOrder() {}

    public double getRemainingToReceive() {
        return Math.max(0, quantity - receivedQty);
    }
}
