package com.annamithra.dto;

import java.util.List;

public class PrepareDispatchRequest {
    public String branchName;
    public List<DispatchItemLine> items;

    public static class DispatchItemLine {
        public Long requestId; // Null for additional non-requested items
        public Long itemId;
        public String itemName;
        public Long departmentId;
        public String departmentName;
        public String unit;
        public String department;
        public double dispatchQty;
        public boolean isAdditional;

        public String getEffectiveDepartment() {
            if (departmentName != null && !departmentName.isBlank()) return departmentName.trim();
            if (department != null && !department.isBlank()) return department.trim();
            return null;
        }
    }
}
