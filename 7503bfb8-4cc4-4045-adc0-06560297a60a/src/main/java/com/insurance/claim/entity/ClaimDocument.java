package com.insurance.claim.entity;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ClaimDocument {

    private Long id;
    private Long claimId;
    private String claimNo;
    private Long businessId;
    private String businessType;
    private Integer documentType;
    private String documentName;
    private String documentUrl;
    private String fileType;
    private Long fileSize;
    private String storagePath;
    private String storageBucket;
    private String md5;
    private Integer uploadStatus;
    private Long uploaderId;
    private String uploaderName;
    private String remark;
    private Integer deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
