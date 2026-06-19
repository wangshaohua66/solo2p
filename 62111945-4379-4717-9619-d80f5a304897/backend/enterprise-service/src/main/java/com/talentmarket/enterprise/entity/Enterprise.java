package com.talentmarket.enterprise.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("enterprise")
public class Enterprise extends BaseEntity {

    private String enterpriseName;

    private String unifiedSocialCreditCode;

    private String legalPerson;

    private String registeredCapital;

    private String registrationDate;

    private String businessScope;

    private String industry;

    private String enterpriseType;

    private Integer employeeCount;

    private String province;

    private String city;

    private String address;

    private String businessLicenseUrl;

    private String contactName;

    private String contactPhone;

    private String contactEmail;

    private String officialWebsite;

    private String companyLogo;

    private String companyDescription;

    private Integer authStatus;

    private String authRemark;

    private java.time.LocalDateTime authTime;

    private Long authBy;

    private Integer verified;

    private java.time.LocalDateTime verifiedTime;

    private Integer historyScore;

    private Integer status;
}
