package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "department", uniqueConstraints = {
    @UniqueConstraint(name = "uk_department_org_name", columnNames = {"organisationId", "name"})
})
public class Department {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false, length = 100)
    public String name;

    @Column(nullable = false)
    public boolean active = true;

    public LocalDateTime createdAt = LocalDateTime.now();
    public String createdBy;
    public LocalDateTime updatedAt = LocalDateTime.now();

    public Department() {}

    public Department(Long organisationId, String name, String createdBy) {
        this.organisationId = organisationId;
        this.name = name;
        this.createdBy = createdBy;
        this.active = true;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}

