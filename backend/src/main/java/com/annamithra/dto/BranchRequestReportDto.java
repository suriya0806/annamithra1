package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class BranchRequestReportDto {
    public Long id;
    public LocalDate date;
    public LocalDateTime createdAt;
    public String branchName;
    public String itemName;
    public String unit;
    public String category;
    public String department;
    public double requestedQuantity;
    public double dispatchedQuantity;
    public double acknowledgedReceivedQuantity;
    public double remainingQuantity;
    public String status;

    public BranchRequestReportDto() {}

    public BranchRequestReportDto(Long id, LocalDate date, LocalDateTime createdAt, String branchName, String itemName, String unit, double requestedQuantity, double dispatchedQuantity, double acknowledgedReceivedQuantity, double remainingQuantity, String status) {
        this(id, date, createdAt, branchName, itemName, unit, null, requestedQuantity, dispatchedQuantity, acknowledgedReceivedQuantity, remainingQuantity, status);
    }

    public BranchRequestReportDto(Long id, LocalDate date, LocalDateTime createdAt, String branchName, String itemName, String unit, String category, double requestedQuantity, double dispatchedQuantity, double acknowledgedReceivedQuantity, double remainingQuantity, String status) {
        this.id = id;
        this.date = date;
        this.createdAt = createdAt;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.category = category;
        this.department = (category != null && !category.isBlank()) ? category.trim() : "Not specified";
        this.requestedQuantity = requestedQuantity;
        this.dispatchedQuantity = dispatchedQuantity;
        this.acknowledgedReceivedQuantity = acknowledgedReceivedQuantity;
        this.remainingQuantity = remainingQuantity;
        this.status = status;
    }
}
