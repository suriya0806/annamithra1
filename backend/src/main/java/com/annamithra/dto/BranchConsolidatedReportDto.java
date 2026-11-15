package com.annamithra.dto;

import java.util.List;
import java.util.Map;

public class BranchConsolidatedReportDto {
    public String reportType; // "REQUESTS", "DISPATCHES", "INVENTORY"
    public String fromDate;
    public String toDate;
    public int totalGroups; // total branches or categories
    public int overallTotalItems;
    public String grandTotalQuantityFormatted;
    public Map<String, Double> grandTotalQuantityByUnit;

    // 1. Branch-wise Summary View rows (one row per branch/group)
    public List<BranchSummaryRowDto> summaryRows;

    // 2. Details View groups (each group has heading and item breakdown)
    public List<BranchDetailsGroupDto> detailsGroups;

    public BranchConsolidatedReportDto() {}

    public static class BranchSummaryRowDto {
        public Long groupId; // branchId or categoryId
        public String groupName; // branchName or categoryName
        public int totalItems; // count of distinct items
        public String totalQuantityFormatted; // e.g. "250 KG" or "250 KG, 10 L"
        public Map<String, Double> quantityByUnit;

        public BranchSummaryRowDto() {}
    }

    public static class BranchDetailsGroupDto {
        public Long groupId; // branchId or categoryId
        public String groupName; // branchName or categoryName
        public List<ConsolidatedItemDto> items;
        public int totalItems;
        public String subtotalQuantityFormatted;
        public Map<String, Double> subtotalQuantityByUnit;

        public BranchDetailsGroupDto() {}
    }

    public static class ConsolidatedItemDto {
        public Long itemId;
        public String itemName;
        public String department;
        public String unit;
        public double totalQuantity;
        public double requestedQuantity;
        public double deliveredQuantity;
        public double deliveryQuantity;
        public String deliveryDate;
        public String acknowledgementStatus;

        public ConsolidatedItemDto() {}
    }
}

