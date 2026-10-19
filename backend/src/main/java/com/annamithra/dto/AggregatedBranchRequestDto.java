package com.annamithra.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class AggregatedBranchRequestDto {
    public String branch;
    public LocalDate requestDate;
    public String formattedDate;
    public String item;
    public String unit;
    public int totalRequestedQuantity;
    public int alreadyDispatchedQuantity;
    public int confirmedReceivedQuantity;
    public int remainingToDispatch;
    public String deliveryStatus;       // COMPLETED, PARTIALLY_DELIVERED, PENDING
    public String deliveryStatusLabel;  // "Delivered / Completed", "Partially Delivered", "Pending Acknowledgement", "Pending"
    public List<BranchRequestHistoryDto> history = new ArrayList<>();

    public AggregatedBranchRequestDto() {}

    public AggregatedBranchRequestDto(String branch, LocalDate requestDate, String formattedDate,
                                     String item, String unit,
                                     int totalRequestedQuantity, int alreadyDispatchedQuantity,
                                     int confirmedReceivedQuantity, int remainingToDispatch,
                                     String deliveryStatus, String deliveryStatusLabel,
                                     List<BranchRequestHistoryDto> history) {
        this.branch = branch;
        this.requestDate = requestDate;
        this.formattedDate = formattedDate;
        this.item = item;
        this.unit = unit;
        this.totalRequestedQuantity = totalRequestedQuantity;
        this.alreadyDispatchedQuantity = alreadyDispatchedQuantity;
        this.confirmedReceivedQuantity = confirmedReceivedQuantity;
        this.remainingToDispatch = remainingToDispatch;
        this.deliveryStatus = deliveryStatus;
        this.deliveryStatusLabel = deliveryStatusLabel;
        this.history = history != null ? history : new ArrayList<>();
    }
}
