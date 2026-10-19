package com.annamithra.dto;

public class CreateItemRequest {
    public String name;
    public String unit;

    public CreateItemRequest() {}

    public CreateItemRequest(String name, String unit) {
        this.name = name;
        this.unit = unit;
    }
}
