package com.annamithra.dto;

public class CreateVendorRequest {
    public String name;
    public String contactPhone;
    public String address;
    public String gstNumber;

    public CreateVendorRequest() {}

    public CreateVendorRequest(String name, String contactPhone, String address, String gstNumber) {
        this.name = name;
        this.contactPhone = contactPhone;
        this.address = address;
        this.gstNumber = gstNumber;
    }
}

