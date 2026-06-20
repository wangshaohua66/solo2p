package com.mw.trace.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class TraceTimeline {

    private String traceCode;

    private String manifestNo;

    private String orgName;

    private String category;

    private Double weightKg;

    private String status;

    private List<TimelineEvent> events;
}
