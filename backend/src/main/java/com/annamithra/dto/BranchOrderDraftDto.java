package com.annamithra.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class BranchOrderDraftDto {

    public static class DraftItemLine {
        public Long itemId;
        public String itemName;
        public Long departmentId;
        public String departmentName;
        public String unit;
        public String category;
        public String department;
        public double requestedQuantity;
        public boolean isNewItem;

        public DraftItemLine() {}

        public DraftItemLine(String itemName, String unit, String category, double requestedQuantity, boolean isNewItem) {
            this(null, itemName, null, category, unit, category, requestedQuantity, isNewItem);
        }

        public DraftItemLine(Long itemId, String itemName, Long departmentId, String departmentName, String unit, String category, double requestedQuantity, boolean isNewItem) {
            this.itemId = itemId;
            this.itemName = itemName;
            this.departmentId = departmentId;
            this.departmentName = departmentName;
            this.unit = unit;
            this.category = category;
            this.department = (departmentName != null && !departmentName.isBlank()) ? departmentName : category;
            this.requestedQuantity = requestedQuantity;
            this.isNewItem = isNewItem;
        }

        public String getEffectiveDepartment() {
            if (departmentName != null && !departmentName.isBlank()) return departmentName.trim();
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
