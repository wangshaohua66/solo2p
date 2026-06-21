package com.gov.specialequipment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device_status_log")
public class DeviceStatusLog extends BaseEntity {

    private Long deviceId;

    private String deviceCode;

    private Integer fromStatus;

    private Integer toStatus;

    private String changeReason;

    private String operatorName;

    private LocalDateTime operateTime;

    private String remark;
}
