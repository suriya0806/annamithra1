package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispatch")
public class Dispatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;
    public String dispatchNumber;
    public Long requestId; // Null for additional items

    public LocalDate dispatchDate = LocalDate.now();
    public LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    public String branchName;

    public Long branchId;

    @Column(nullable = false)
    public String itemName;

    public String unit = "KG";

    @Column(nullable = false)
    public int quantity; // Dispatched Quantity

    public boolean isAdditional = false;

    @Column(nullable = false)
    public String status = "PENDING"; // PENDING, ACKNOWLEDGED

    public int acknowledgedQuantity = 0; // Actual received quantity
    public int shortageQuantity = 0; // Dispatched - Actual Received
    public String acknowledgementStatus; // FULLY_RECEIVED, PARTIALLY_RECEIVED, NOT_RECEIVED
    public String acknowledgementRemarks; // Remarks explaining shortage or damage
    public LocalDateTime acknowledgedAt;
    public String acknowledgedBy;

    public int returnedQuantity = 0;
    public LocalDateTime returnedAt;
    public String returnReason;

    public String dispatchedBy;

    public Dispatch() {}

    public int getPendingAcknowledgementQuantity() {
        return "ACKNOWLEDGED".equalsIgnoreCase(status) ? 0 : quantity;
    }

    public int getAvailableToReturn() {
        return Math.max(0, quantity - returnedQuantity);
    }
}
