package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispatch_return")
public class DispatchReturn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false)
    public Long dispatchId;

    public String dispatchNumber;

    @Column(nullable = false)
    public String branchName;

    @Column(nullable = false)
    public String itemName;

    public String unit = "KG";

    @Column(nullable = false)
    public int returnQuantity;

    public String reason;

    public LocalDateTime returnDate = LocalDateTime.now();

    public String returnedBy;

    public DispatchReturn() {}

    public DispatchReturn(Long dispatchId, String dispatchNumber, String branchName, String itemName,
                          String unit, int returnQuantity, String reason, LocalDateTime returnDate, String returnedBy) {
        this.dispatchId = dispatchId;
        this.dispatchNumber = dispatchNumber;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.returnQuantity = returnQuantity;
        this.reason = reason;
        this.returnDate = returnDate != null ? returnDate : LocalDateTime.now();
        this.returnedBy = returnedBy;
    }

    public DispatchReturn(Long organisationId, Long dispatchId, String dispatchNumber, String branchName, String itemName,
                          String unit, int returnQuantity, String reason, LocalDateTime returnDate, String returnedBy) {
        this.organisationId = organisationId;
        this.dispatchId = dispatchId;
        this.dispatchNumber = dispatchNumber;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.returnQuantity = returnQuantity;
        this.reason = reason;
        this.returnDate = returnDate != null ? returnDate : LocalDateTime.now();
        this.returnedBy = returnedBy;
    }
}
