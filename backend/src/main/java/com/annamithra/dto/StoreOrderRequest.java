package com.annamithra.dto;

import java.util.List;

public class StoreOrderRequest {
    public List<OrderItem> items;

    public static class OrderItem {
        public String itemName;
        public String unit;
        public double requiredQuantity;
        public double orderQuantity;
        public java.time.LocalDate requestDate;
    }
}
