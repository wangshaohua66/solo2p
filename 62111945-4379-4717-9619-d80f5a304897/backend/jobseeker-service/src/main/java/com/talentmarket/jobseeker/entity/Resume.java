package com.talentmarket.jobseeker.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("resume")
public class Resume extends BaseEntity {

    private Long jobseekerId;
    private String resumeTitle;
    private Integer isDefault;
    private Integer privacy;
    private String name;
    private String gender;
    private Integer age;
    private String phone;
    private String email;
    private String city;
    private String highestEducation;
    private Integer yearsOfExperience;
    private String currentStatus;
    private String expectedPosition;
    private Integer expectedSalaryMin;
    private Integer expectedSalaryMax;
    private String expectedCity;
    private String selfIntroduction;
    private String resumeFileUrl;
    private String resumeFileName;
    @TableField(exist = false)
    private List<String> skills;
    private String skillTags;
    private Integer completeRate;
    private Integer status;
}
