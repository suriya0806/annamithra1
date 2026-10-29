package com.annamithra.dto;

public class UpdateItemRequest {
    public String name;
    public String unit;
    public String category;
    public Long categoryId;

    public UpdateItemRequest() {}

    public UpdateItemRequest(String name, String unit, String category, Long categoryId) {
        this.name = name;
        this.unit = unit;
        this.category = category;
        this.categoryId = categoryId;
    }
}

