package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Schema(description = "理赔案件查询请求")
public class ClaimQueryRequest {

    @Schema(description = "页码", example = "1")
    private Integer pageNum = 1;

    @Schema(description = "每页条数", example = "10")
    private Integer pageSize = 10;

    @Schema(description = "案件编号", example = "CL2024011500001")
    @Size(max = 32, message = "案件编号长度不能超过32字符")
    private String claimNo;

    @Schema(description = "保单号", example = "POL2024010100001")
    @Size(max = 32, message = "保单号长度不能超过32字符")
    private String policyNo;

    @Schema(description = "险种代码 1-车险 2-家财险 3-企财险", example = "1")
    private Integer insuranceType;

    @Schema(description = "案件状态", example = "1")
    private Integer status;

    @Schema(description = "报案人姓名", example = "张三")
    @Size(max = 50, message = "报案人姓名长度不能超过50字符")
    private String reporterName;

    @Schema(description = "报案人电话", example = "13800138000")
    @Size(max = 11, message = "报案人电话长度不能超过11字符")
    private String reporterPhone;

    @Schema(description = "车牌号", example = "京A12345")
    @Size(max = 10, message = "车牌号长度不能超过10字符")
    private String vehiclePlateNo;

    @Schema(description = "查勘员ID", example = "2001")
    private Long surveyorId;

    @Schema(description = "定损员ID", example = "3001")
    private Long assessorId;

    @Schema(description = "核赔师ID", example = "4001")
    private Long reviewerId;

    @Schema(description = "事故省份", example = "北京市")
    @Size(max = 20, message = "事故省份长度不能超过20字符")
    private String accidentProvince;

    @Schema(description = "事故城市", example = "北京市")
    @Size(max = 20, message = "事故城市长度不能超过20字符")
    private String accidentCity;

    @Schema(description = "是否欺诈可疑", example = "false")
    private Boolean fraudSuspicious;

    @Schema(description = "报案开始时间")
    private LocalDateTime reportStartTime;

    @Schema(description = "报案结束时间")
    private LocalDateTime reportEndTime;

    @Schema(description = "事故开始时间")
    private LocalDateTime accidentStartTime;

    @Schema(description = "事故结束时间")
    private LocalDateTime accidentEndTime;

    @Schema(description = "机构编码", example = "BRANCH001")
    @Size(max = 32, message = "机构编码长度不能超过32字符")
    private String branchCode;

    @Schema(description = "排序字段", example = "createdAt")
    private String orderBy = "createdAt";

    @Schema(description = "排序方向 asc-升序 desc-降序", example = "desc")
    private String orderDirection = "desc";
}
