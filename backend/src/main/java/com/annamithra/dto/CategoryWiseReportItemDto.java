package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class CategoryWiseReportItemDto {
    public Long id;
    public String itemName;
    public String category;
    public String unit;
    public String branchName;
    public String department;
    public double requestedQuantity;
    public double dispatchedQuantity;
    public double pendingQuantity;
    public LocalDate requestDate;
    public LocalDate dispatchDate;
    public LocalDateTime dispatchDateTime;
    public String dispatchStatus; // "Dispatched", "Partially Dispatched", "Pending"
    public String status; // Raw status e.g. "PENDING", "COMPLETED"

    public CategoryWiseReportItemDto() {}

    public CategoryWiseReportItemDto(Long id, String itemName, String category, String unit, String branchName, String department, double requestedQuantity, double dispatchedQuantity, double pendingQuantity, LocalDate requestDate, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String dispatchStatus, String status) {
        this.id = id;
        this.itemName = itemName;
        this.category = (category != null && !category.isBlank()) ? category.trim() : "Uncategorised";
        this.unit = (unit != null && !unit.isBlank()) ? unit.trim().toUpperCase() : "KG";
        this.branchName = branchName;
        this.department = (department != null && !department.isBlank()) ? department.trim() : "Unassigned";
        this.requestedQuantity = requestedQuantity;
        this.dispatchedQuantity = dispatchedQuantity;
        this.pendingQuantity = pendingQuantity;
        this.requestDate = requestDate;
        this.dispatchDate = dispatchDate;
        this.dispatchDateTime = dispatchDateTime;
        this.dispatchStatus = dispatchStatus;
        this.status = status;
    }
}

