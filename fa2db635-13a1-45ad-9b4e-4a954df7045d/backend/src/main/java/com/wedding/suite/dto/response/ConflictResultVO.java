package com.wedding.suite.dto.response;

import com.wedding.suite.entity.ScheduleTaskEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ConflictResultVO {
    private boolean conflict;
    private List<ScheduleTaskEntity> conflicts;
    private List<ResourceVO> alternatives;
    private long costMs;
}
