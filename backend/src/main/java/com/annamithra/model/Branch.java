package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "branch")
public class Branch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public String location;

    public Long organisationId;
    public String manager; // Manager user ID
    public String contact;
    public LocalDateTime createdAt = LocalDateTime.now();

    public Branch() {}

    public Branch(String name, String location, String manager, String contact) {
        this.name = name;
        this.location = location;
        this.manager = manager;
        this.contact = contact;
    }

    public Branch(String name, String location, Long organisationId, String manager, String contact) {
        this.name = name;
        this.location = location;
        this.organisationId = organisationId;
        this.manager = manager;
        this.contact = contact;
    }
}
