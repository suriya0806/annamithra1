package com.annamithra.dto;

public class CreateCategoryRequest {
    public String name;
    public Long organisationId;

    public CreateCategoryRequest() {}

    public CreateCategoryRequest(String name) {
        this.name = name;
    }
}

