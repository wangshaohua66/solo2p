package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("license")
public class License implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("license_no")
    private String licenseNo;

    @TableField("retailer_id")
    private Long retailerId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_type")
    private String licenseType;

    @TableField("business_type")
    private String businessType;

    @TableField("business_scope")
    private String businessScope;

    @TableField("legal_person")
    private String legalPerson;

    @TableField("id_card_no")
    private String idCardNo;

    @TableField("phone")
    private String phone;

    @TableField("province")
    private String province;

    @TableField("city")
    private String city;

    @TableField("county")
    private String county;

    @TableField("address")
    private String address;

    @TableField("longitude")
    private BigDecimal longitude;

    @TableField("latitude")
    private BigDecimal latitude;

    @TableField("application_type")
    private String applicationType;

    @TableField("status")
    private Integer status;

    @TableField("tier")
    private Integer tier;

    @TableField("issue_date")
    private LocalDate issueDate;

    @TableField("expire_date")
    private LocalDate expireDate;

    @TableField("first_reviewer_id")
    private Long firstReviewerId;

    @TableField("first_review_time")
    private LocalDateTime firstReviewTime;

    @TableField("first_review_opinion")
    private String firstReviewOpinion;

    @TableField("second_reviewer_id")
    private Long secondReviewerId;

    @TableField("second_review_time")
    private LocalDateTime secondReviewTime;

    @TableField("second_review_opinion")
    private String secondReviewOpinion;

    @TableField("final_reviewer_id")
    private Long finalReviewerId;

    @TableField("final_review_time")
    private LocalDateTime finalReviewTime;

    @TableField("final_review_opinion")
    private String finalReviewOpinion;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("original_license_id")
    private Long originalLicenseId;

    @TableField("remark")
    private String remark;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
