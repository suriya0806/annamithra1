package com.annamithra.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class VendorEntryRequest {
    public Long vendorId;
    public String vendorName;
    public String clientSubmissionId;
    public LocalDate entryDate;
    public String paymentMode; // CASH, UPI, BANK_TRANSFER, CREDIT
    public String receivedBy;
    public String broughtBy;
    public String remarks;
    public List<VendorEntryItemRequest> items = new ArrayList<>();

    public VendorEntryRequest() {}

    public static class VendorEntryItemRequest {
        public Long itemId;
        public String itemName;
        public String unit;
        public Double quantity;
        public Double unitRate;
        public Double totalRate;

        public VendorEntryItemRequest() {}

        public VendorEntryItemRequest(Long itemId, String itemName, String unit, Double quantity) {
            this.itemId = itemId;
            this.itemName = itemName;
            this.unit = unit;
            this.quantity = quantity;
            this.unitRate = 0.0;
            this.totalRate = 0.0;
        }

        public VendorEntryItemRequest(Long itemId, String itemName, String unit, Double quantity, Double unitRate, Double totalRate) {
            this.itemId = itemId;
            this.itemName = itemName;
            this.unit = unit;
            this.quantity = quantity;
            this.unitRate = unitRate;
            this.totalRate = totalRate;
        }
    }
}

