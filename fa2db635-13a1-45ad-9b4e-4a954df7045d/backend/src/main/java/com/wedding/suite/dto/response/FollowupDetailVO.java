package com.wedding.suite.dto.response;

import com.wedding.suite.entity.FollowTaskEntity;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class FollowupDetailVO {
    private WeddingVO wedding;
    private long countdown;
    private List<FollowTaskEntity> tasks;
}
