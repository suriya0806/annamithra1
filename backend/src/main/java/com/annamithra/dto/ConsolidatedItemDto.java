package com.annamithra.dto;

public class ConsolidatedItemDto {
    public String itemName;
    public String unit;
    public int totalRequiredQuantity; // Outstanding requirement quantity
    public int availableStock;
    public int totalBranchRequirement;
    public int alreadyAllocatedQuantity;
    public int outstandingRequirement;

    public ConsolidatedItemDto() {}

    public ConsolidatedItemDto(String itemName, String unit, int totalRequiredQuantity, int availableStock) {
        this.itemName = itemName;
        this.unit = unit;
        this.totalRequiredQuantity = totalRequiredQuantity;
        this.availableStock = availableStock;
        this.totalBranchRequirement = totalRequiredQuantity;
        this.alreadyAllocatedQuantity = 0;
        this.outstandingRequirement = totalRequiredQuantity;
    }

    public ConsolidatedItemDto(String itemName, String unit, int outstandingRequirement, int availableStock, int totalBranchRequirement, int alreadyAllocatedQuantity) {
        this.itemName = itemName;
        this.unit = unit;
        this.totalRequiredQuantity = outstandingRequirement;
        this.availableStock = availableStock;
        this.totalBranchRequirement = totalBranchRequirement;
        this.alreadyAllocatedQuantity = alreadyAllocatedQuantity;
        this.outstandingRequirement = outstandingRequirement;
    }
}
