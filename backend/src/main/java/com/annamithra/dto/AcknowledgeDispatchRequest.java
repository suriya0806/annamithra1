package com.annamithra.dto;

public class AcknowledgeDispatchRequest {
    public Integer actualReceivedQty;
    public String remarks;

    public AcknowledgeDispatchRequest() {}

    public AcknowledgeDispatchRequest(Integer actualReceivedQty, String remarks) {
        this.actualReceivedQty = actualReceivedQty;
        this.remarks = remarks;
    }
}
