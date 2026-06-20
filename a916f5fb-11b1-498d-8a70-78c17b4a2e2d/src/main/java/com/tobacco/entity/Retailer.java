package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("retailer")
public class Retailer implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("retailer_name")
    private String retailerName;

    @TableField("license_no")
    private String licenseNo;

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

    @TableField("business_type")
    private String businessType;

    @TableField("tier")
    private Integer tier;

    @TableField("credit_level")
    private String creditLevel;

    @TableField("credit_score")
    private Integer creditScore;

    @TableField("consecutive_no_violation_periods")
    private Integer consecutiveNoViolationPeriods;

    @TableField("register_date")
    private LocalDate registerDate;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField("grid_id")
    private Long gridId;

    @TableField("status")
    private Integer status;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField("deleted")
    @TableLogic
    private Integer deleted;
}
