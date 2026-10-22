package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class BranchRequestHistoryDto {
    public Long id;
    public LocalDate requestDate;
    public String formattedDate;
    public String requestTime;
    public LocalDateTime createdAt;
    public String item;
    public String unit;
    public String category;
    public int requested;
    public int dispatched;
    public int received;
    public String status;

    public BranchRequestHistoryDto() {}

    public BranchRequestHistoryDto(Long id, LocalDate requestDate, String formattedDate,
                                  String requestTime, LocalDateTime createdAt,
                                  String item, String unit, int requested,
                                  int dispatched, int received, String status) {
        this(id, requestDate, formattedDate, requestTime, createdAt, item, unit, null, requested, dispatched, received, status);
    }

    public BranchRequestHistoryDto(Long id, LocalDate requestDate, String formattedDate,
                                  String requestTime, LocalDateTime createdAt,
                                  String item, String unit, String category, int requested,
                                  int dispatched, int received, String status) {
        this.id = id;
        this.requestDate = requestDate;
        this.formattedDate = formattedDate;
        this.requestTime = requestTime;
        this.createdAt = createdAt;
        this.item = item;
        this.unit = unit;
        this.category = category;
        this.requested = requested;
        this.dispatched = dispatched;
        this.received = received;
        this.status = status;
    }
}
