package com.annamithra.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class BranchRequestDateSectionDto {
    public LocalDate requestDate;
    public String formattedDate; // e.g. "18 October 2026"
    public List<AggregatedBranchRequestDto> items = new ArrayList<>();

    public BranchRequestDateSectionDto() {}

    public BranchRequestDateSectionDto(LocalDate requestDate, String formattedDate, List<AggregatedBranchRequestDto> items) {
        this.requestDate = requestDate;
        this.formattedDate = formattedDate;
        this.items = items != null ? items : new ArrayList<>();
    }
}
