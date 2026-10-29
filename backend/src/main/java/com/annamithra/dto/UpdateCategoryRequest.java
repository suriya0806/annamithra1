package com.annamithra.dto;

public class UpdateCategoryRequest {
    public String name;
    public Boolean active;

    public UpdateCategoryRequest() {}

    public UpdateCategoryRequest(String name, Boolean active) {
        this.name = name;
        this.active = active;
    }
}

