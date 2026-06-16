package com.emergency.dispatch.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.emergency.common.dto.GeoPoint;
import com.emergency.common.entity.BaseEntity;
import com.emergency.common.enums.TeamStatus;
import com.emergency.dispatch.handler.GeoPointTypeHandler;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "rescue_team", autoResultMap = true)
public class RescueTeam extends BaseEntity {

    private String teamCode;

    private String teamName;

    private String teamType;

    private Integer teamSize;

    private Long organizationId;

    private String regionCode;

    private String address;

    @TableField(typeHandler = GeoPointTypeHandler.class)
    private GeoPoint locationPoint;

    private String leaderName;

    private String leaderPhone;

    private TeamStatus status;

    private Integer currentTaskCount;

    private String equipment;

    private String capabilities;

    private Integer responseRadius;

    private Double averageArrivalTime;

    private String remark;
}
