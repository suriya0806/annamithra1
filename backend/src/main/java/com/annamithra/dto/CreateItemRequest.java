package com.annamithra.dto;

public class CreateItemRequest {
    public String name;
    public String unit;
    public String category;
    public Long categoryId;
    public Long organisationId;

    public CreateItemRequest() {}

    public CreateItemRequest(String name, String unit) {
        this.name = name;
        this.unit = unit;
    }

    public CreateItemRequest(String name, String unit, String category) {
        this.name = name;
        this.unit = unit;
        this.category = category;
    }

    public CreateItemRequest(String name, String unit, String category, Long categoryId) {
        this.name = name;
        this.unit = unit;
        this.category = category;
        this.categoryId = categoryId;
    }
}
