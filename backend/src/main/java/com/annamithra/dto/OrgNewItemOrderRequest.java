package com.annamithra.dto;

import java.util.List;

public class OrgNewItemOrderRequest {
    public List<NewItemLine> items;

    public static class NewItemLine {
        public String name;
        public String unit;
        public double quantity;
    }
}
