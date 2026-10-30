package com.annamithra.dto;

public class ConsolidatedItemDto {
    public String itemName;
    public String unit;
    public double totalRequiredQuantity; // Outstanding requirement quantity
    public double availableStock;
    public double totalBranchRequirement;
    public double alreadyAllocatedQuantity;
    public double outstandingRequirement;

    public ConsolidatedItemDto() {}

    public ConsolidatedItemDto(String itemName, String unit, double totalRequiredQuantity, double availableStock) {
        this.itemName = itemName;
        this.unit = unit;
        this.totalRequiredQuantity = totalRequiredQuantity;
        this.availableStock = availableStock;
        this.totalBranchRequirement = totalRequiredQuantity;
        this.alreadyAllocatedQuantity = 0;
        this.outstandingRequirement = totalRequiredQuantity;
    }

    public ConsolidatedItemDto(String itemName, String unit, double outstandingRequirement, double availableStock, double totalBranchRequirement, double alreadyAllocatedQuantity) {
        this.itemName = itemName;
        this.unit = unit;
        this.totalRequiredQuantity = outstandingRequirement;
        this.availableStock = availableStock;
        this.totalBranchRequirement = totalBranchRequirement;
        this.alreadyAllocatedQuantity = alreadyAllocatedQuantity;
        this.outstandingRequirement = outstandingRequirement;
    }
}
