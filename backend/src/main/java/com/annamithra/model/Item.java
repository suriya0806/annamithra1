package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "item")
public class Item {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    public Long organisationId;

    @Column(nullable = false)
    public String name;

    @Column(nullable = false)
    public String unit;

    @Column(nullable = false)
    public int stock = 0;

    public LocalDateTime createdAt = LocalDateTime.now();

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
}
