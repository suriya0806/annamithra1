package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class VendorEntryDto {
    public Long id;
    public String entryNumber;
    public Long organisationId;
    public Long branchId;
    public Long vendorId;
    public String vendorName;
    public LocalDate entryDate;
    public LocalDateTime entryDateTime;
    public String status;
    public String remarks;
    public String clientSubmissionId;
    public Integer totalItems;
    public Double totalQuantity;
    public String paymentMode;
    public Double grandTotal;
    public String receivedBy;
    public String broughtBy;
    public String createdBy;
    public Long createdByUserId;
    public LocalDateTime createdAt;
    public List<VendorEntryItemDto> items = new ArrayList<>();

    public VendorEntryDto() {}

    public VendorEntryDto(Long id, String entryNumber, Long organisationId, Long branchId, Long vendorId,
                          String vendorName, LocalDate entryDate, LocalDateTime entryDateTime, String status,
                          String remarks, String clientSubmissionId, Integer totalItems, Double totalQuantity,
                          String paymentMode, Double grandTotal, String receivedBy, String broughtBy,
                          String createdBy, Long createdByUserId, LocalDateTime createdAt) {
        this.id = id;
        this.entryNumber = entryNumber;
        this.organisationId = organisationId;
        this.branchId = branchId;
        this.vendorId = vendorId;
        this.vendorName = vendorName;
        this.entryDate = entryDate;
        this.entryDateTime = entryDateTime;
        this.status = status;
        this.remarks = remarks;
        this.clientSubmissionId = clientSubmissionId;
        this.totalItems = totalItems;
        this.totalQuantity = totalQuantity;
        this.paymentMode = paymentMode != null ? paymentMode : "CASH";
        this.grandTotal = grandTotal != null ? grandTotal : 0.0;
        this.receivedBy = receivedBy;
        this.broughtBy = broughtBy;
        this.createdBy = createdBy;
        this.createdByUserId = createdByUserId;
        this.createdAt = createdAt;
    }

    public VendorEntryDto(Long id, String entryNumber, Long organisationId, Long branchId, Long vendorId,
                          String vendorName, LocalDate entryDate, LocalDateTime entryDateTime, String status,
                          String remarks, String clientSubmissionId, Integer totalItems, Double totalQuantity,
                          String paymentMode, Double grandTotal,
                          String createdBy, Long createdByUserId, LocalDateTime createdAt) {
        this(id, entryNumber, organisationId, branchId, vendorId, vendorName, entryDate, entryDateTime,
             status, remarks, clientSubmissionId, totalItems, totalQuantity, paymentMode, grandTotal, null, null,
             createdBy, createdByUserId, createdAt);
    }

    public VendorEntryDto(Long id, String entryNumber, Long organisationId, Long branchId, Long vendorId,
                          String vendorName, LocalDate entryDate, LocalDateTime entryDateTime, String status,
                          String remarks, String clientSubmissionId, Integer totalItems, Double totalQuantity,
                          String createdBy, Long createdByUserId, LocalDateTime createdAt) {
        this(id, entryNumber, organisationId, branchId, vendorId, vendorName, entryDate, entryDateTime,
             status, remarks, clientSubmissionId, totalItems, totalQuantity, "CASH", 0.0, createdBy, createdByUserId, createdAt);
    }
}

