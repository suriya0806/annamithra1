package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "purchase_order_header")
public class PurchaseOrderHeader {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(name = "order_number", nullable = false)
    public String orderNumber; // e.g. "ORDER01", "ORDER02"

    public String source; // "STORE_MANAGER", "ORGANISATION_ADMIN"

    public String status = "PENDING"; // PENDING, ORDERED, PARTIALLY_RECEIVED, RECEIVED

    public LocalDate orderDate = LocalDate.now();
    public LocalDateTime createdAt = LocalDateTime.now();
    public String createdBy;

    public LocalDateTime orderedAt;
    public String orderedBy;

    public PurchaseOrderHeader() {}

    public PurchaseOrderHeader(String orderNumber, String source, String createdBy) {
        this.orderNumber = orderNumber;
        this.source = source != null ? source : "STORE_MANAGER";
        this.createdBy = createdBy;
        this.status = "PENDING";
        this.orderDate = LocalDate.now();
        this.createdAt = LocalDateTime.now();
    }

    public PurchaseOrderHeader(Long organisationId, String orderNumber, String source, String createdBy) {
        this.organisationId = organisationId;
        this.orderNumber = orderNumber;
        this.source = source != null ? source : "STORE_MANAGER";
        this.createdBy = createdBy;
        this.status = "PENDING";
        this.orderDate = LocalDate.now();
        this.createdAt = LocalDateTime.now();
    }
}
