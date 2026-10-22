package com.annamithra.dto;

import java.util.List;

public class MultiItemBranchRequest {
    public List<ItemLine> items;

    public static class ItemLine {
        public String itemName;
        public String unit;
        public String category;
        public int requestedQuantity;
        public boolean isNewItem;
    }
}
