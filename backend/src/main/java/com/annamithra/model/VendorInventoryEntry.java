package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "vendor_inventory_entry")
public class VendorInventoryEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(unique = true)
    public String entryNumber;

    @Column(nullable = false)
    public Long organisationId;

    public Long branchId;

    @Column(nullable = false)
    public Long vendorId;

    @Column(nullable = false)
    public String vendorName;

    @Column(nullable = false)
    public LocalDate entryDate = LocalDate.now();

    @Column(nullable = false)
    public LocalDateTime entryDateTime = LocalDateTime.now();

    @Column(nullable = false)
    public String status = "SAVED";

    public String remarks;
    public String clientSubmissionId;
    public Integer totalItems = 0;
    public Double totalQuantity = 0.0;

    public String paymentMode = "CASH";
    public Double grandTotal = 0.0;

    public String receivedBy;
    public String broughtBy;

    @Column(nullable = false)
    public String createdBy;

    public Long createdByUserId;
    public LocalDateTime createdAt = LocalDateTime.now();
    public LocalDateTime updatedAt = LocalDateTime.now();
    public String updatedBy;

    public VendorInventoryEntry() {}

    public VendorInventoryEntry(Long organisationId, Long vendorId, String vendorName, LocalDate entryDate,
                                LocalDateTime entryDateTime, String remarks, String clientSubmissionId,
                                String createdBy, Long createdByUserId) {
        this.organisationId = organisationId;
        this.vendorId = vendorId;
        this.vendorName = vendorName;
        this.entryDate = entryDate != null ? entryDate : LocalDate.now();
        this.entryDateTime = entryDateTime != null ? entryDateTime : LocalDateTime.now();
        this.status = "SAVED";
        this.remarks = remarks;
        this.clientSubmissionId = clientSubmissionId;
        this.createdBy = createdBy;
        this.createdByUserId = createdByUserId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}

