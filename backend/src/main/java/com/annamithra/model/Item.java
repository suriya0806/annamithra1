package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "item", uniqueConstraints = {
    @UniqueConstraint(name = "uk_item_org_name", columnNames = {"organisationId", "name"})
})
public class Item {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false)
    public String name;

    public Long categoryId;

    public String category;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public int stock = 0;

    public LocalDateTime createdAt = LocalDateTime.now();

    public String createdBy;

    public LocalDateTime updatedAt = LocalDateTime.now();

    public Item() {}

    public Item(String name, String unit, int stock) {
        this.name = name;
        this.unit = unit;
        this.stock = stock;
    }

    public Item(Long organisationId, String name, String unit, int stock) {
        this.organisationId = organisationId;
        this.name = name;
        this.unit = unit;
        this.stock = stock;
    }

    public Item(Long organisationId, String name, String unit, int stock, String category) {
        this.organisationId = organisationId;
        this.name = name;
        this.unit = unit;
        this.stock = stock;
        this.category = category;
    }

    public Item(Long organisationId, String name, String unit, int stock, String category, Long categoryId, String createdBy) {
        this.organisationId = organisationId;
        this.name = name;
        this.unit = unit;
        this.stock = stock;
        this.category = category;
        this.categoryId = categoryId;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }
}
