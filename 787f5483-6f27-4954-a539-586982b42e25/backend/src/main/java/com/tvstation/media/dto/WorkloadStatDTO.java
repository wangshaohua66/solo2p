package com.tvstation.media.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkloadStatDTO {

    private String department;

    private Long userId;

    private String userName;

    private Long topicCount;

    private Long materialCount;

    private Long programDuration;

    private Long reviewCount;

    private String period;
}
