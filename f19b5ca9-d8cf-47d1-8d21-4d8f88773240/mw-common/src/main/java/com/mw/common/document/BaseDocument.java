package com.mw.common.document;

import lombok.Data;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

@Data
public abstract class BaseDocument implements Persistable<String>, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Id
    private String id;

    @CreatedDate
    private LocalDateTime createTime;

    @LastModifiedDate
    private LocalDateTime updateTime;

    @CreatedBy
    private String createdBy;

    @LastModifiedBy
    private String updatedBy;

    private Integer deleted = 0;

    @Override
    public boolean isNew() {
        return id == null;
    }
}
