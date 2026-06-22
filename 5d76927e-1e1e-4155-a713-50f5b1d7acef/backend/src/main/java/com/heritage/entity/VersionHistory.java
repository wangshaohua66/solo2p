package com.heritage.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VersionHistory {

    private String version;

    private String changeLog;

    private String modifiedBy;

    private LocalDateTime modifiedAt;
}
