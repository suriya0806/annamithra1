package com.annamithra.dto;

public class DirectStockRequest {
    public String itemName;
    public String name;
    public String unit;
    public Integer quantity;

    public DirectStockRequest() {}

    public DirectStockRequest(String itemName, String unit, Integer quantity) {
        this.itemName = itemName;
        this.name = itemName;
        this.unit = unit;
        this.quantity = quantity;
    }

    public String getItemName() {
        if (itemName != null && !itemName.trim().isEmpty()) {
            return itemName;
        }
        return name;
    }
}
