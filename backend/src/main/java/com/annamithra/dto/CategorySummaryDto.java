package com.annamithra.dto;

import java.util.Map;

public class CategorySummaryDto {
    public String category;
    public int totalItems;
    public Map<String, Double> requestedByUnit;
    public Map<String, Double> dispatchedByUnit;
    public Map<String, Double> pendingByUnit;

    public CategorySummaryDto() {}

    public CategorySummaryDto(String category, int totalItems, Map<String, Double> requestedByUnit, Map<String, Double> dispatchedByUnit, Map<String, Double> pendingByUnit) {
        this.category = category;
        this.totalItems = totalItems;
        this.requestedByUnit = requestedByUnit;
        this.dispatchedByUnit = dispatchedByUnit;
        this.pendingByUnit = pendingByUnit;
    }
}

