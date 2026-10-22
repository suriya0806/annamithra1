package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class BranchDispatchReportDto {
    public Long id;
    public String dispatchNumber;
    public LocalDate dispatchDate;
    public LocalDateTime dispatchDateTime;
    public String branchName;
    public String itemName;
    public String unit;
    public String category;
    public int requestedQuantity;
    public int dispatchedQuantity;
    public int acknowledgedQuantity;
    public int pendingAcknowledgementQuantity;
    public String status;
    public LocalDateTime acknowledgedAt;
    public String acknowledgedBy;

    public int shortageQuantity;
    public String acknowledgementStatus;
    public String acknowledgementRemarks;

    public BranchDispatchReportDto() {}

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, int requestedQuantity, int dispatchedQuantity, int acknowledgedQuantity, int pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, itemName, unit, null, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, 0, null, null);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, String category, int requestedQuantity, int dispatchedQuantity, int acknowledgedQuantity, int pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy) {
        this(id, dispatchNumber, dispatchDate, dispatchDateTime, branchName, itemName, unit, category, requestedQuantity, dispatchedQuantity, acknowledgedQuantity, pendingAcknowledgementQuantity, status, acknowledgedAt, acknowledgedBy, 0, null, null);
    }

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, String category, int requestedQuantity, int dispatchedQuantity, int acknowledgedQuantity, int pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy, int shortageQuantity, String acknowledgementStatus, String acknowledgementRemarks) {
        this.id = id;
        this.dispatchNumber = dispatchNumber;
        this.dispatchDate = dispatchDate;
        this.dispatchDateTime = dispatchDateTime;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.category = category;
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
