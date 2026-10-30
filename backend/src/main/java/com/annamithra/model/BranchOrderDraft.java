package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "branch_order_draft")
public class BranchOrderDraft {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    public Long branchId;

    @Column(nullable = false)
    public String branchName;

    public String draftName;

    @Column(nullable = false)
    public String status = "DRAFT"; // DRAFT, MOVED_TO_ORDER

    public int itemCount = 0;

    public double totalQuantity = 0.0;

    @Column(columnDefinition = "TEXT", nullable = false)
    public String itemsJson = "[]";

    @Column(length = 100)
    public String department;

    public LocalDateTime createdAt = LocalDateTime.now();

    public LocalDateTime updatedAt = LocalDateTime.now();

    public String createdBy;

    public BranchOrderDraft() {}

    public BranchOrderDraft(Long organisationId, Long branchId, String branchName, String draftName, String status, int itemCount, double totalQuantity, String itemsJson, String createdBy) {
        this.organisationId = organisationId;
        this.branchId = branchId;
        this.branchName = branchName;
        this.draftName = draftName;
        this.status = status != null ? status : "DRAFT";
        this.itemCount = itemCount;
        this.totalQuantity = totalQuantity;
        this.itemsJson = itemsJson != null ? itemsJson : "[]";
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
