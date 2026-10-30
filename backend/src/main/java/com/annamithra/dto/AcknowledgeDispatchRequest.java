package com.annamithra.dto;

public class AcknowledgeDispatchRequest {
    public Double actualReceivedQty;
    public String remarks;

    public AcknowledgeDispatchRequest() {}

    public AcknowledgeDispatchRequest(Double actualReceivedQty, String remarks) {
        this.actualReceivedQty = actualReceivedQty;
        this.remarks = remarks;
    }
}
