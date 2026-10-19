package com.annamithra.dto;

public class DirectStockResponseDto {
    public String itemName;
    public String unit;
    public int quantityAdded;
    public int newStock;
    public boolean isNewItem;

    public DirectStockResponseDto() {}

    public DirectStockResponseDto(String itemName, String unit, int quantityAdded, int newStock, boolean isNewItem) {
        this.itemName = itemName;
        this.unit = unit;
        this.quantityAdded = quantityAdded;
        this.newStock = newStock;
        this.isNewItem = isNewItem;
    }
}
