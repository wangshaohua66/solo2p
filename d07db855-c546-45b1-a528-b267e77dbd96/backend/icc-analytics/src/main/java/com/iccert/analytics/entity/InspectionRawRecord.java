package com.iccert.analytics.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 检测原始记录（防篡改追加式存储）。
 * 对应数据库表 raw_record，该表无逻辑删除字段(is_deleted)与更新时间字段(update_time)，
 * 因此不继承 BaseEntity，避免 MyBatis-Plus 自动注入不存在的列。
 */
@Data
@TableName("raw_record")
public class InspectionRawRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 记录编号 */
    private String recordCode;

    /** 关联检测任务ID */
    private Long taskId;

    /** 关联检测项ID */
    private Long taskItemId;

    /** 关联样品ID */
    private Long sampleId;

    /** 记录类型：DATA/PHOTO/VIDEO/AUDIO */
    private String recordType;

    /** 记录内容（测试数据快照JSON，参与哈希计算，防篡改核心字段） */
    private String recordContent;

    /** 附件URL（照片、文件等） */
    private String recordUrl;

    /** 当前记录哈希（SHA-256哈希链） */
    private String recordHash;

    /** 上一条记录哈希（构建哈希链） */
    private String prevRecordHash;

    /** 检测人员ID */
    private Long testerId;

    /** 检测人员姓名 */
    private String testerName;

    /** 检测时间 */
    private LocalDateTime testTime;

    /** 检测设备ID */
    private Long equipmentId;

    /** 检测设备快照（设备编号、校准状态等JSON，固化检测条件） */
    private String equipmentSnapshot;

    /** 环境快照（温湿度等环境参数JSON，固化检测条件） */
    private String environmentSnapshot;

    /** 是否不可修改：1-是（默认），0-否 */
    private Integer isImmutable;

    /** 创建时间 */
    private LocalDateTime createTime;
}
