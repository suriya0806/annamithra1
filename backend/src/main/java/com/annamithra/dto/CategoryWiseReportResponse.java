package com.annamithra.dto;

import java.util.List;

public class CategoryWiseReportResponse {
    public List<CategorySummaryDto> summary;
    public List<CategoryWiseReportItemDto> items;

    public CategoryWiseReportResponse() {}

    public CategoryWiseReportResponse(List<CategorySummaryDto> summary, List<CategoryWiseReportItemDto> items) {
        this.summary = summary;
        this.items = items;
    }
}

