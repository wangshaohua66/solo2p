package com.carbon.common.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.io.Serializable;
import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "audit_logs")
@CompoundIndex(name = "tenant_module_created_idx", def = "{'tenantId': 1, 'module': 1, 'createdAt': -1}")
public class AuditLogRecord implements Serializable {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String traceId;

    private String userId;

    private String username;

    private String organizationId;

    @Indexed
    private String module;

    private String operation;

    private String resourceType;

    private String resourceId;

    private String method;

    private String uri;

    private String clientIp;

    private String userAgent;

    @Field(targetType = FieldType.DOUBLE)
    private Double durationMs;

    private Integer statusCode;

    private Boolean success;

    private String errorCode;

    private String errorMessage;

    private Map<String, Object> requestSnapshot;

    private Map<String, Object> responseSnapshot;

    @Indexed(name = "audit_ttl_idx", expireAfterSeconds = 0)
    private Instant expireAt;

    @Indexed
    private Instant createdAt;
}
