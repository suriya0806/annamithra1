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
    public int requestedQuantity;
    public int dispatchedQuantity;
    public int acknowledgedQuantity;
    public int pendingAcknowledgementQuantity;
    public String status;
    public LocalDateTime acknowledgedAt;
    public String acknowledgedBy;

    public BranchDispatchReportDto() {}

    public BranchDispatchReportDto(Long id, String dispatchNumber, LocalDate dispatchDate, LocalDateTime dispatchDateTime, String branchName, String itemName, String unit, int requestedQuantity, int dispatchedQuantity, int acknowledgedQuantity, int pendingAcknowledgementQuantity, String status, LocalDateTime acknowledgedAt, String acknowledgedBy) {
        this.id = id;
        this.dispatchNumber = dispatchNumber;
        this.dispatchDate = dispatchDate;
        this.dispatchDateTime = dispatchDateTime;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.requestedQuantity = requestedQuantity;
        this.dispatchedQuantity = dispatchedQuantity;
        this.acknowledgedQuantity = acknowledgedQuantity;
        this.pendingAcknowledgementQuantity = pendingAcknowledgementQuantity;
        this.status = status;
        this.acknowledgedAt = acknowledgedAt;
        this.acknowledgedBy = acknowledgedBy;
    }
}
