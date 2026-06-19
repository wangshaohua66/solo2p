package com.talentmarket.recruitment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("fair_booth")
public class FairBooth extends BaseEntity {

    private Long fairId;
    private String boothCode;
    private String boothArea;
    private Integer boothNumber;
    private String boothType;
    private Integer qualityScore;
    private Long enterpriseId;
    private String enterpriseName;
    private Integer status;
    private Double matchScore;
    private String industry;
}
