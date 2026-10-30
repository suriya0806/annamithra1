package com.annamithra.dto;

import java.util.List;

public class MultiItemBranchRequest {
    public String department;
    public List<ItemLine> items;

    public String getEffectiveDepartment() {
        if (department != null && !department.isBlank()) {
            return department.trim();
        }
        return null;
    }

    public static class ItemLine {
        public String itemName;
        public String unit;
        public String category;
        public String department;
        public double requestedQuantity;
        public boolean isNewItem;

        public String getEffectiveDepartment() {
            if (department != null && !department.isBlank()) {
                return department.trim();
            }
            if (category != null && !category.isBlank()) {
                return category.trim();
            }
            return null;
        }
    }
}
