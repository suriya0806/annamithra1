package com.annamithra.dto;

import java.util.List;

public class PrepareDispatchRequest {
    public String branchName;
    public List<DispatchItemLine> items;

    public static class DispatchItemLine {
        public Long requestId; // Null for additional non-requested items
        public String itemName;
        public String unit;
        public int dispatchQty;
        public boolean isAdditional;
    }
}
