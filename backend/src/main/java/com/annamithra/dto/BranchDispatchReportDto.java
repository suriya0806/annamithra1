package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class BranchDispatchReportDto {
    public Long id;
    public String dispatchNumber;
    public LocalDate dispatchDate;
    public LocalDateTime dispatchDateTime;
    public String branchName;
    public Long itemId;
    public String itemName;
    public String unit;
    public String category;
    public Long departmentId;
    public String department;
    public double requestedQuantity;
    public double dispatchedQuantity;
    public double acknowledgedQuantity;
    public double pendingAcknowledgementQuantity;
    public String status;
    public LocalDateTime acknowledgedAt;
    public String acknowledgedBy;

    public double shortageQuantity;
    public String acknowledgementStatus;
    public String acknowledgementRemarks;

    public BranchDispatchReportDto() {}

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, double requestedQuantity, double dispatchedQuantity, double acknowledgedQuantity, double pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, itemName, unit, null, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, 0, null, null);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, String category, double requestedQuantity, double dispatchedQuantity, double acknowledgedQuantity, double pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, itemName, unit, category, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, 0, null, null);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, String category, double requestedQuantity, double dispatchedQuantity, double acknowledgedQuantity, double pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy, double shortageQuantity, String acknowledgementStatus, String acknowledgementRemarks) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, itemName, unit, category, category, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, shortageQuantity, acknowledgementStatus, acknowledgementRemarks);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, String category, String department, double requestedQuantity, double dispatchedQuantity, double acknowledgedQuantity, double pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy, double shortageQuantity, String acknowledgementStatus, String acknowledgementRemarks) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, null, itemName, unit, category, null, department, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, shortageQuantity, acknowledgementStatus, acknowledgementRemarks);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, Long itemId, String itemName, String unit, String category, Long departmentId, String department, double requestedQuantity, double dispatchedQuantity, double acknowledgedQuantity, double pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy, double shortageQuantity, String acknowledgementStatus, String acknowledgementRemarks) {
        this.id = id;
        this.dispatchNumber = dispatchNumber;
        this.dispatchDate = dispatchDate;
        this.dispatchDateTime = dispatchDateTime;
        this.branchName = branchName;
        this.itemId = itemId;
        this.itemName = itemName;
        this.unit = unit;
        this.category = category;
        this.departmentId = departmentId;
        this.department = (department != null && !department.isBlank())
                ? department.trim()
                : ((category != null && !category.isBlank()) ? category.trim() : "Unassigned");
        this.requestedQuantity = requestedQuantity;
        this.dispatchedQuantity = dispatchedQuantity;
        this.acknowledgedQuantity = acknowledgedQuantity;
        this.pendingAcknowledgementQuantity = pendingAcknowledgementQuantity;
        this.status = status;
        this.acknowledgedAt = acknowledgedAt;
        this.acknowledgedBy = acknowledgedBy;
        this.shortageQuantity = shortageQuantity;
        this.acknowledgementStatus = acknowledgementStatus;
        this.acknowledgementRemarks = acknowledgementRemarks;
    }
}
