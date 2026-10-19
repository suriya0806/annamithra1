package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "branch_request")
public class BranchRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;
    public String batchId;

    @Column(updatable = false)
    public LocalDate requestDate = LocalDate.now();

    @Column(updatable = false)
    public LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    public String branch;

    public Long branchId;

    @Column(nullable = false)
    public String item;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public int requested;

    public int dispatched = 0; // Already Dispatched Quantity

    public int received = 0; // Confirmed Received Quantity

    @Column(nullable = false)
    public String status = "PENDING"; // PENDING, PARTIALLY_DISPATCHED, DISPATCHED, PARTIALLY_RECEIVED, COMPLETED

    public BranchRequest() {}

    public int getRemainingToDispatch() {
        return Math.max(0, requested - dispatched);
    }

    public int getRemainingToReceive() {
        return Math.max(0, requested - received);
    }
}
