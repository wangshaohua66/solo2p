package com.talentmarket.enterprise.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("job_position")
public class JobPosition extends BaseEntity {

    private Long enterpriseId;

    private String positionName;

    private String positionType;

    private Integer salaryMin;

    private Integer salaryMax;

    private String salaryType;

    private String city;

    private String district;

    private String address;

    private String experienceRequired;

    private String educationRequired;

    private Integer recruitCount;

    private String positionDescription;

    private String requirements;

    private List<String> skillTags;

    private List<String> welfareTags;

    private String benefits;

    private String workAddress;

    private String companyIntroduction;

    private String department;

    private String reportTo;

    private Integer workType;

    private BigDecimal matchScore;

    private Integer status;

    private Integer auditStatus;

    private String auditRemark;

    private Long auditBy;

    private java.time.LocalDateTime auditTime;

    private Integer viewCount;

    private Integer applyCount;
}
