package com.annamithra.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class BranchOrderDraftDto {

    public static class DraftItemLine {
        public String itemName;
        public String unit;
        public String category;
        public String department;
        public double requestedQuantity;
        public boolean isNewItem;

        public DraftItemLine() {}

        public DraftItemLine(String itemName, String unit, String category, double requestedQuantity, boolean isNewItem) {
            this.itemName = itemName;
            this.unit = unit;
            this.category = category;
            this.department = category;
            this.requestedQuantity = requestedQuantity;
            this.isNewItem = isNewItem;
        }

        public String getEffectiveDepartment() {
            if (department != null && !department.isBlank()) return department.trim();
            if (category != null && !category.isBlank()) return category.trim();
            return null;
        }
    }

    public static class SaveDraftRequest {
        public String draftName;
        public String department;
        public List<DraftItemLine> items = new ArrayList<>();

        public SaveDraftRequest() {}
    }

    public static class DraftResponse {
        public Long id;
        public Long organisationId;
        public Long branchId;
        public String branchName;
        public String draftName;
        public String department;
        public String status;
        public int itemCount;
        public double totalQuantity;
        public List<DraftItemLine> items = new ArrayList<>();
        public LocalDateTime createdAt;
        public LocalDateTime updatedAt;
        public String createdBy;

        public DraftResponse() {}
    }
}
