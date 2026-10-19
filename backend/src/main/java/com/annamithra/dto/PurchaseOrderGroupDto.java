package com.annamithra.dto;

import com.annamithra.model.PurchaseOrder;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class PurchaseOrderGroupDto {
    public Long id;
    public String orderNumber;
    public String source;
    public String status;
    public LocalDate orderDate;
    public LocalDateTime createdAt;
    public String createdBy;
    public List<PurchaseOrder> lines = new ArrayList<>();

    public PurchaseOrderGroupDto() {}

    public PurchaseOrderGroupDto(String orderNumber, String source, String status, LocalDate orderDate, LocalDateTime createdAt, String createdBy) {
        this.orderNumber = orderNumber;
        this.source = source;
        this.status = status;
        this.orderDate = orderDate;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
    }
}
