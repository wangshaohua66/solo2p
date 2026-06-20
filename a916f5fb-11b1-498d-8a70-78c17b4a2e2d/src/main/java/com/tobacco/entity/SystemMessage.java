package com.tobacco.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_message")
public class SystemMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("msg_no")
    private String msgNo;

    @TableField("msg_type")
    private String msgType;

    @TableField("title")
    private String title;

    @TableField("content")
    private String content;

    @TableField("receiver_id")
    private Long receiverId;

    @TableField("receiver_name")
    private String receiverName;

    @TableField("receiver_type")
    private String receiverType;

    @TableField("related_id")
    private Long relatedId;

    @TableField("related_type")
    private String relatedType;

    @TableField("is_read")
    private Integer isRead;

    @TableField("read_time")
    private LocalDateTime readTime;

    @TableField("push_status")
    private Integer pushStatus;

    @TableField("push_channel")
    private String pushChannel;

    @TableField("county_id")
    private Long countyId;

    @TableField("station_id")
    private Long stationId;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
