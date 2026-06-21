package com.gov.specialequipment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DeviceStatusChangeDTO {

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotNull(message = "目标状态不能为空")
    private Integer targetStatus;

    @NotBlank(message = "变更原因不能为空")
    private String changeReason;

    private String remark;
}
