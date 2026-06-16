package com.crew.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("crew_member")
public class CrewMember {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String crewCode;

    private String name;

    private String type;

    private String rank;

    private String base;

    private String language;

    private String status;

    private Double monthlyFlightHours;

    private Double weeklyFlightHours;

    private Integer consecutiveDutyDays;

    private LocalDateTime lastDutyEnd;

    private Integer timezoneOffset;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
