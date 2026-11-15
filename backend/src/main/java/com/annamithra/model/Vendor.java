package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "vendor")
public class Vendor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public Long organisationId;

    @Column(nullable = false)
    public String name;

    public String contactPhone;
    public String address;
    public String gstNumber;

    @Column(nullable = false)
    public boolean active = true;

    public String createdBy;
    public LocalDateTime createdAt = LocalDateTime.now();
    public LocalDateTime updatedAt = LocalDateTime.now();

    public Vendor() {}

    public Vendor(Long organisationId, String name, String contactPhone, String address, String gstNumber, String createdBy) {
        this.organisationId = organisationId;
        this.name = name;
        this.contactPhone = contactPhone;
        this.address = address;
        this.gstNumber = gstNumber;
        this.active = true;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}

