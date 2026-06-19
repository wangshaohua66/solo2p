package com.talentmarket.recruitment.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.talentmarket.common.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("recruitment_fair")
public class RecruitmentFair extends BaseEntity {

    private String fairName;
    private String fairType;
    private String organizer;
    private String coOrganizer;
    private LocalDate startDate;
    private LocalDate endDate;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String venue;
    private String address;
    private String city;
    private String district;
    private String fairTheme;
    private String description;
    private String coverImage;
    private Integer boothTotal;
    private Integer boothAvailable;
    private Integer participantLimit;
    private Integer currentParticipants;
    private Integer intentionCount;
    private String status;
    private Integer published;
    private LocalDateTime publishTime;
    private String qrCodeUrl;
    private String signInQrCode;
    private Long centerId;
    private String centerName;
}
