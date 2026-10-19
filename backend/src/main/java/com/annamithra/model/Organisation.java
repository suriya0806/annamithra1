package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "organisations")
public class Organisation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String name;

    @Column(unique = true, nullable = false)
    public String code;

    @Column(nullable = false)
    public String status = "ACTIVE"; // "ACTIVE" or "INACTIVE"

    public String adminName;
    public String adminEmail;
    public String contactPhone;
    public String address;

    public LocalDateTime createdAt = LocalDateTime.now();
    public LocalDateTime updatedAt = LocalDateTime.now();

    public Organisation() {}

    public Organisation(String name, String code, String adminName, String adminEmail, String contactPhone, String address) {
        this.name = name;
        this.code = code;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.contactPhone = contactPhone;
        this.address = address;
        this.status = "ACTIVE";
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
