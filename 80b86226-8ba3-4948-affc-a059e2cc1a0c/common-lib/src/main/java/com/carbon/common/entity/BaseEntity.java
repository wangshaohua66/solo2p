package com.carbon.common.entity;

import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;

import java.io.Serializable;
import java.time.Instant;

@Data
@CompoundIndex(name = "tenant_created_idx", def = "{'tenantId': 1, 'createdAt': -1}")
public abstract class BaseEntity implements Serializable {

    @Transient
    private static final long serialVersionUID = 1L;

    @Id
    private String id;

    @Indexed
    private String tenantId;

    @CreatedBy
    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedBy
    private String updatedBy;

    @LastModifiedDate
    private Instant updatedAt;

    private Boolean deleted;

    private Instant deletedAt;
}
