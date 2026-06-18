package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 实验室能力认可范围实体。
 * 对应 lab_ability_scope 表：含 create_time 与 update_time，但无 is_deleted，
 * 因此不继承 BaseEntity（避免 @TableLogic 注入不存在的 is_deleted 列）。
 */
@Data
@TableName("lab_ability_scope")
public class LabAbilityScope implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long labId;

    private Long productCategoryId;

    private Long certTypeId;

    private String standardCode;

    private String standardName;

    private String testItemScope;

    private String accreditationNo;

    private LocalDate accreditationDate;

    private LocalDate expireDate;

    private Integer status;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;
}
