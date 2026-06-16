package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("flight")
public class Flight {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String flightNo;

    private String departure;

    private String arrival;

    private LocalDateTime departureTime;

    private LocalDateTime arrivalTime;

    private String aircraftType;

    private Integer timezoneDiff;

    private Boolean isRedEye;

    private Integer requiredPilots;

    private Integer requiredAttendants;

    private String languageRequired;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
