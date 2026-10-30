package com.annamithra.dto;

public class ReportSummaryDto {
    public long totalPurchaseOrders;
    public double totalItemsOrdered;
    public double totalQuantityReceived;
    public double totalQuantityDispatched;
    public double totalPendingAcknowledgement;

    public ReportSummaryDto() {}

    public ReportSummaryDto(long totalPurchaseOrders, double totalItemsOrdered, double totalQuantityReceived, double totalQuantityDispatched, double totalPendingAcknowledgement) {
        this.totalPurchaseOrders = totalPurchaseOrders;
        this.totalItemsOrdered = totalItemsOrdered;
        this.totalQuantityReceived = totalQuantityReceived;
        this.totalQuantityDispatched = totalQuantityDispatched;
        this.totalPendingAcknowledgement = totalPendingAcknowledgement;
    }
}
