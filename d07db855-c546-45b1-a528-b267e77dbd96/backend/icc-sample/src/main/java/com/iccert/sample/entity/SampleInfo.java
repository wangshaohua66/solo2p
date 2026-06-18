package com.iccert.sample.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.iccert.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sample_info")
public class SampleInfo extends BaseEntity {
    private String sampleCode;
    private String sampleName;
    private String sampleModel;
    private String sampleCodeInternal;
    private Long companyId;
    private String companyName;
    private Long productCategoryId;
    private String productCategoryName;
    private Long certTypeId;
    private String certTypeCode;
    private Integer sampleAmount;
    private String sampleUnit;
    private Long receiverId;
    private String receiverName;
    private LocalDateTime receiveTime;
    private String sampleStatus;
    private String storageLocation;
    private LocalDate retentionExpireDate;
    private LocalDateTime destroyTime;
    private String destroyOperator;
    private String destroyRemark;
    private String priority;
    private String remark;
    private Long createBy;
}
