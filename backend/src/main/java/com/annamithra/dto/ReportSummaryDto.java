package com.annamithra.dto;

public class ReportSummaryDto {
    public long totalPurchaseOrders;
    public long totalItemsOrdered;
    public long totalQuantityReceived;
    public long totalQuantityDispatched;
    public long totalPendingAcknowledgement;

    public ReportSummaryDto() {}

    public ReportSummaryDto(long totalPurchaseOrders, long totalItemsOrdered, long totalQuantityReceived, long totalQuantityDispatched, long totalPendingAcknowledgement) {
        this.totalPurchaseOrders = totalPurchaseOrders;
        this.totalItemsOrdered = totalItemsOrdered;
        this.totalQuantityReceived = totalQuantityReceived;
        this.totalQuantityDispatched = totalQuantityDispatched;
        this.totalPendingAcknowledgement = totalPendingAcknowledgement;
    }
}
