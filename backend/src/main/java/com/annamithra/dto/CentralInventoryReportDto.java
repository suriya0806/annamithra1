package com.annamithra.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class CentralInventoryReportDto {
    public Long itemId;
    public String itemName;
    public String unit;
    public double currentStock;
    public double totalQuantityReceived;
    public double totalQuantityDispatched;
    public LocalDateTime lastUpdated;
    public List<InventoryActivityDto> activity = new ArrayList<>();

    public CentralInventoryReportDto() {}

    public CentralInventoryReportDto(Long itemId, String itemName, String unit, double currentStock, double totalQuantityReceived, double totalQuantityDispatched) {
        this.itemId = itemId;
        this.itemName = itemName;
        this.unit = unit;
        this.currentStock = currentStock;
        this.totalQuantityReceived = totalQuantityReceived;
        this.totalQuantityDispatched = totalQuantityDispatched;
    }

    public CentralInventoryReportDto(Long itemId, String itemName, String unit, int currentStock, int totalQuantityReceived, int totalQuantityDispatched, LocalDateTime lastUpdated) {
        this(itemId, itemName, unit, currentStock, totalQuantityReceived, totalQuantityDispatched);
        this.lastUpdated = lastUpdated;
    }
}
