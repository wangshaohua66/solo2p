package com.talentmarket.interview.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("interview")
public class Interview extends BaseEntity {

    private Long enterpriseId;

    private String enterpriseName;

    private Long jobseekerId;

    private String jobseekerName;

    private String jobseekerPhone;

    private Long jobPositionId;

    private String jobTitle;

    private Integer interviewType;

    private LocalDateTime interviewTime;

    private Integer durationMinutes;

    private String location;

    private String roomId;

    private String status;

    private String hrId;

    private String hrName;

    private String hrPhone;

    private LocalDateTime confirmTime;

    private String rejectReason;

    private String result;

    private Integer rating;

    private String feedback;

    private LocalDateTime endTime;

    private String cancelReason;

    private String cancelBy;

    private LocalDateTime cancelTime;

    private String remark;
}
