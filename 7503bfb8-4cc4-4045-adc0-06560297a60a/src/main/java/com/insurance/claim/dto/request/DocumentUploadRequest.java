package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "文档上传请求")
public class DocumentUploadRequest {

    @Schema(description = "文档类型 1-事故现场照片 2-交警认定书 3-查勘照片 4-定损单 5-发票 6-其他", requiredMode = Schema.RequiredMode.REQUIRED, example = "1")
    @NotBlank(message = "文档类型不能为空")
    private Integer documentType;

    @Schema(description = "文档名称", requiredMode = Schema.RequiredMode.REQUIRED, example = "事故现场照片1.jpg")
    @NotBlank(message = "文档名称不能为空")
    @Size(max = 200, message = "文档名称长度不能超过200字符")
    private String documentName;

    @Schema(description = "文档URL", requiredMode = Schema.RequiredMode.REQUIRED, example = "https://oss.example.com/claim/20240115/photo1.jpg")
    @NotBlank(message = "文档URL不能为空")
    @Size(max = 500, message = "文档URL长度不能超过500字符")
    private String documentUrl;

    @Schema(description = "文件类型", example = "image/jpeg")
    @Size(max = 50, message = "文件类型长度不能超过50字符")
    private String fileType;

    @Schema(description = "文件大小(字节)", example = "1024000")
    private Long fileSize;

    @Schema(description = "业务类型", example = "claim_report")
    @Size(max = 32, message = "业务类型长度不能超过32字符")
    private String businessType;

    @Schema(description = "MD5值", example = "d41d8cd98f00b204e9800998ecf8427e")
    @Size(max = 32, message = "MD5值长度不能超过32字符")
    private String md5;
}
