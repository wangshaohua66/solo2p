package com.mw.trace.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class TimelineEvent {

    private LocalDateTime time;

    private String stage;

    private String title;

    private String detail;

    private String operator;
}
