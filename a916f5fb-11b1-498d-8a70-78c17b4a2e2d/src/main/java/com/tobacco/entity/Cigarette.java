package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("cigarette")
public class Cigarette implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("cigarette_code")
    private String cigaretteCode;

    @TableField("cigarette_name")
    private String cigaretteName;

    @TableField("brand")
    private String brand;

    @TableField("specification")
    private String specification;

    @TableField("unit_price")
    private BigDecimal unitPrice;

    @TableField("tar_content")
    private BigDecimal tarContent;

    @TableField("nicotine_content")
    private BigDecimal nicotineContent;

    @TableField("category")
    private String category;

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
