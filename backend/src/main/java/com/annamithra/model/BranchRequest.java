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
    public double requested;

    public String category;

    @Column(length = 100)
    public String department;

    @com.fasterxml.jackson.annotation.JsonProperty("department")
    public String getDepartment() {
        if (department != null && !department.isBlank()) {
            return department;
        }
        return category;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("department")
    public void setDepartment(String dep) {
        if (dep != null && !dep.isBlank()) {
            this.department = dep.trim();
            this.category = dep.trim();
        }
    }

    public double dispatched = 0; // Already Dispatched Quantity

    public double received = 0; // Confirmed Received Quantity

    @Column(nullable = false)
    public String status = "PENDING"; // PENDING, PARTIALLY_DISPATCHED, DISPATCHED, PARTIALLY_RECEIVED, COMPLETED

    public BranchRequest() {}

    public double getRemainingToDispatch() {
        return Math.max(0, requested - dispatched);
    }

    public double getRemainingToReceive() {
        return Math.max(0, requested - received);
    }
}
