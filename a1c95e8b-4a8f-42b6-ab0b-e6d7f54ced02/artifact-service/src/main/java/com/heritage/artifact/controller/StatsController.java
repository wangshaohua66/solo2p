package com.heritage.artifact.controller;

import com.heritage.artifact.common.Result;
import com.heritage.artifact.enums.ArtifactLevel;
import com.heritage.artifact.enums.ArtifactStatus;
import com.heritage.artifact.enums.ArtifactType;
import com.heritage.artifact.repository.ArtifactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final ArtifactRepository artifactRepository;

    @GetMapping("/overview")
    public Result<Map<String, Object>> getOverview() {
        Map<String, Object> result = new HashMap<>();
        result.put("total", artifactRepository.count());

        Map<String, Long> typeStats = new HashMap<>();
        for (ArtifactType type : ArtifactType.values()) {
            typeStats.put(type.getName(), artifactRepository.countByType(type));
        }
        result.put("byType", typeStats);

        Map<String, Long> levelStats = new HashMap<>();
        for (ArtifactLevel level : ArtifactLevel.values()) {
            levelStats.put(level.getName(), artifactRepository.countByLevel(level));
        }
        result.put("byLevel", levelStats);

        Map<String, Long> statusStats = new HashMap<>();
        for (ArtifactStatus status : ArtifactStatus.values()) {
            statusStats.put(status.getName(), artifactRepository.countByStatus(status));
        }
        result.put("byStatus", statusStats);

        return Result.success(result);
    }
}
