package com.annamithra.dto;

import java.util.List;
import java.util.Map;

public class VendorEntryReportDto {
    public String viewMode; // "summary" or "details"
    public String fromDate;
    public String toDate;
    public int totalVendors;
    public double grandTotalAmount;
    public String grandTotalQuantityFormatted;
    public Map<String, Double> grandTotalQuantityByUnit;

    // Summary View Data
    public List<VendorSummaryRowDto> summaryRows;

    // Details View Data
    public List<VendorDetailsGroupDto> detailsGroups;

    public VendorEntryReportDto() {}

    public static class VendorSummaryRowDto {
        public Long vendorId;
        public String vendorName;
        public double totalRate;
        public String totalQuantityFormatted;
        public Map<String, Double> quantityByUnit;
        public int entryCount;
        public int itemCount;

        public VendorSummaryRowDto() {}
    }

    public static class VendorDetailsGroupDto {
        public Long vendorId;
        public String vendorName;
        public List<VendorConsolidatedItemDto> items;
        public double subtotalAmount;
        public String subtotalQuantityFormatted;
        public Map<String, Double> subtotalQuantityByUnit;
        public int entryCount;

        public VendorDetailsGroupDto() {}
    }

    public static class VendorConsolidatedItemDto {
        public Long itemId;
        public String itemName;
        public String unit;
        public double quantity;
        public double unitRate;
        public double totalRate;

        public VendorConsolidatedItemDto() {}
    }
}

