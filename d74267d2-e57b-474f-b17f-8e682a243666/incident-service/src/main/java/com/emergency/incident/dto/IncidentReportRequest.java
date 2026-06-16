package com.emergency.incident.dto;

import com.emergency.common.dto.GeoPoint;
import com.emergency.common.enums.IncidentType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Schema(description = "灾情上报请求")
public class IncidentReportRequest implements Serializable {

    @Schema(description = "灾害类型", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "灾害类型不能为空")
    private IncidentType type;

    @Schema(description = "灾情标题", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "灾情标题不能为空")
    private String title;

    @Schema(description = "灾情描述")
    private String description;

    @Schema(description = "发生地点", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotBlank(message = "发生地点不能为空")
    private String location;

    @Schema(description = "地理位置坐标", requiredMode = Schema.RequiredMode.REQUIRED)
    @NotNull(message = "地理位置不能为空")
    private GeoPoint locationPoint;

    @Schema(description = "行政区划代码")
    private String regionCode;

    @Schema(description = "发生时间")
    private LocalDateTime occurredAt;

    @Schema(description = "数据来源: MANUAL-人工填报 WEATHER-气象API SENSOR-传感器")
    @NotBlank(message = "数据来源不能为空")
    private String sourceType;

    @Schema(description = "来源详情")
    private String sourceDetail;

    @Schema(description = "原始数据JSON")
    private String rawData;

    @Schema(description = "影响面积(平方公里)")
    private BigDecimal affectedArea;

    @Schema(description = "受灾人口")
    private Integer affectedPopulation;

    @Schema(description = "死亡人数")
    private Integer casualties;

    @Schema(description = "受伤人数")
    private Integer injured;

    @Schema(description = "失联人数")
    private Integer missing;

    @Schema(description = "被困人数")
    private Integer trapped;

    @Schema(description = "天气情况")
    private String weatherCondition;

    @Schema(description = "地形情况")
    private String terrainCondition;
}
