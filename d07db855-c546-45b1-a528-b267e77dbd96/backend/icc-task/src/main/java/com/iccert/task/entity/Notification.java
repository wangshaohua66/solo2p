package com.iccert.task.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 系统通知实体，对应 sys_notification 表。
 * 该表无逻辑删除字段(is_deleted)与更新时间字段(update_time)，
 * 因此不继承 BaseEntity，避免 MyBatis-Plus 自动注入不存在的列。
 */
@Data
@TableName("sys_notification")
public class Notification implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    private String notificationType;

    private String title;

    private String content;

    private Long targetUserId;

    private String targetRoleCode;

    private String bizType;

    private String bizId;

    private String priority;

    private Integer isRead;

    private LocalDateTime readTime;

    private Integer isPushSent;

    private LocalDateTime pushTime;

    private Integer isEmailSent;

    private LocalDateTime emailSentTime;

    private LocalDateTime createTime;
}
