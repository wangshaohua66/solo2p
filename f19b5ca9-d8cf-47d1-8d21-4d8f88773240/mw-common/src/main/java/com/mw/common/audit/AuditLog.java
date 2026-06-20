package com.mw.common.audit;

import com.mw.common.document.BaseDocument;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "audit_log")
public class AuditLog extends BaseDocument {

    @Indexed
    private String operatorId;

    private String operatorName;

    private String orgId;

    /** 操作类型 */
    private String action;

    /** 业务模块 */
    private String module;

    /** 操作描述 */
    private String description;

    /** 业务主键（联单号/追溯编码/批次号等） */
    @Indexed
    private String businessKey;

    /** 变更前数据 JSON */
    private String beforeData;

    /** 变更后数据 JSON */
    private String afterData;

    /** 请求IP */
    private String ip;

    /** 请求方法 */
    private String requestUri;

    private LocalDateTime operateTime = LocalDateTime.now();
}
