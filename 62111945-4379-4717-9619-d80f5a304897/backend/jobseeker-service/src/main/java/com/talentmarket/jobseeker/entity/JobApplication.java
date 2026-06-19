package com.talentmarket.jobseeker.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("job_application")
public class JobApplication extends BaseEntity {

    private Long jobseekerId;
    private Long resumeId;
    private Long positionId;
    private Long enterpriseId;
    private String positionName;
    private String enterpriseName;
    private String jobseekerName;
    private BigDecimal matchScore;
    private Integer status;
    private String statusName;
    private LocalDateTime viewTime;
    private LocalDateTime interviewTime;
    private String interviewer;
    private String rejectReason;
    private String offerSalary;
    private String remark;
}
