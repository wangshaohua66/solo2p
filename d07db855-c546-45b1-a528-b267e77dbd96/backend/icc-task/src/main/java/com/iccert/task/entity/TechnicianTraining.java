package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 技术员培训记录实体。
 * 对应 technician_training 表：仅含 create_time，无 update_time / is_deleted，
 * 因此不继承 BaseEntity，避免 MyBatis-Plus 注入不存在的列。
 */
@Data
@TableName("technician_training")
public class TechnicianTraining implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long technicianId;

    private String trainingTitle;

    private String trainingContent;

    private LocalDate trainingDate;

    private BigDecimal trainingHours;

    private String trainer;

    private String certificateUrl;

    @TableField("create_time")
    private LocalDateTime createTime;
}
