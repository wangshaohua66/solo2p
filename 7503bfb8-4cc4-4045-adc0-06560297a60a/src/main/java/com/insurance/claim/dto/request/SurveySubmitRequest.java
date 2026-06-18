package com.insurance.claim.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Schema(description = "查勘提交请求")
public class SurveySubmitRequest {

    @Schema(description = "查勘记录ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "3001")
    @NotNull(message = "查勘记录ID不能为空")
    private Long surveyId;

    @Schema(description = "出发时间", example = "2024-01-15T15:00:00")
    private LocalDateTime departedAt;

    @Schema(description = "到达时间", example = "2024-01-15T15:30:00")
    private LocalDateTime arrivedAt;

    @Schema(description = "出发地经度", example = "116.455144")
    private BigDecimal departLongitude;

    @Schema(description = "出发地纬度", example = "39.904989")
    private BigDecimal departLatitude;

    @Schema(description = "到达地经度", example = "116.465144")
    private BigDecimal arriveLongitude;

    @Schema(description = "到达地纬度", example = "39.914989")
    private BigDecimal arriveLatitude;

    @Schema(description = "GPS行驶距离(公里)", example = "5.5")
    private BigDecimal gpsDistance;

    @Schema(description = "GPS校验是否通过", example = "true")
    private Boolean gpsVerified;

    @Schema(description = "天气情况", example = "晴")
    @Size(max = 20, message = "天气情况长度不能超过20字符")
    private String weatherCondition;

    @Schema(description = "道路情况", example = "干燥")
    @Size(max = 20, message = "道路情况长度不能超过20字符")
    private String roadCondition;

    @Schema(description = "现场情况描述", example = "道路平整，视野良好")
    @Size(max = 500, message = "现场情况描述长度不能超过500字符")
    private String siteDescription;

    @Schema(description = "损失情况描述", requiredMode = Schema.RequiredMode.REQUIRED, example = "本车前部保险杠、大灯、引擎盖受损")
    @NotBlank(message = "损失情况描述不能为空")
    @Size(max = 500, message = "损失情况描述长度不能超过500字符")
    private String damageDescription;

    @Schema(description = "现场图URL", example = "https://oss.example.com/claim/20240115/scene.png")
    @Size(max = 500, message = "现场图URL长度不能超过500字符")
    private String sceneDiagram;

    @Schema(description = "责任比例(%)", requiredMode = Schema.RequiredMode.REQUIRED, example = "70")
    @NotNull(message = "责任比例不能为空")
    private Integer liabilityRatio;

    @Schema(description = "责任判定说明", requiredMode = Schema.RequiredMode.REQUIRED, example = "本车追尾，负主要责任")
    @NotBlank(message = "责任判定说明不能为空")
    @Size(max = 500, message = "责任判定说明长度不能超过500字符")
    private String liabilityDetermination;

    @Schema(description = "交警认定书编号", example = "JD20240115001")
    @Size(max = 32, message = "交警认定书编号长度不能超过32字符")
    private String policeReportNo;

    @Schema(description = "交警意见", example = "本车负主要责任")
    @Size(max = 500, message = "交警意见长度不能超过500字符")
    private String policeOpinion;

    @Schema(description = "预估损失金额", example = "8000.00")
    private BigDecimal estimatedLossAmount;

    @Schema(description = "查勘意见", example = "情况属实，建议定损")
    @Size(max = 500, message = "查勘意见长度不能超过500字符")
    private String surveyComments;

    @Schema(description = "查勘照片")
    private List<DocumentUploadRequest> photos;

    @Schema(description = "查勘视频")
    private List<DocumentUploadRequest> videos;

    @Schema(description = "备注", example = "无其他特殊情况")
    @Size(max = 500, message = "备注长度不能超过500字符")
    private String remark;
}
