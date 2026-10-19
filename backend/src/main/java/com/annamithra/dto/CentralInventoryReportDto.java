package com.annamithra.dto;

import java.util.ArrayList;
import java.util.List;

public class CentralInventoryReportDto {
    public Long itemId;
    public String itemName;
    public String unit;
    public int currentStock;
    public int totalQuantityReceived;
    public int totalQuantityDispatched;
    public List<InventoryActivityDto> activity = new ArrayList<>();

    public CentralInventoryReportDto() {}

    public CentralInventoryReportDto(Long itemId, String itemName, String unit, int currentStock, int totalQuantityReceived, int totalQuantityDispatched) {
        this.itemId = itemId;
        this.itemName = itemName;
        this.unit = unit;
        this.currentStock = currentStock;
        this.totalQuantityReceived = totalQuantityReceived;
        this.totalQuantityDispatched = totalQuantityDispatched;
    }
}
