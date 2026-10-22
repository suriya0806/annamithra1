package com.annamithra.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class BranchOrderDraftDto {

    public static class DraftItemLine {
        public String itemName;
        public String unit;
        public String category;
        public int requestedQuantity;
        public boolean isNewItem;

        public DraftItemLine() {}

        public DraftItemLine(String itemName, String unit, String category, int requestedQuantity, boolean isNewItem) {
            this.itemName = itemName;
            this.unit = unit;
            this.category = category;
            this.requestedQuantity = requestedQuantity;
            this.isNewItem = isNewItem;
        }
    }

    public static class SaveDraftRequest {
        public String draftName;
        public List<DraftItemLine> items = new ArrayList<>();

        public SaveDraftRequest() {}
    }

    public static class DraftResponse {
        public Long id;
        public Long organisationId;
        public Long branchId;
        public String branchName;
        public String draftName;
        public String status;
        public int itemCount;
        public int totalQuantity;
        public List<DraftItemLine> items = new ArrayList<>();
        public LocalDateTime createdAt;
        public LocalDateTime updatedAt;
        public String createdBy;

        public DraftResponse() {}
    }
}
