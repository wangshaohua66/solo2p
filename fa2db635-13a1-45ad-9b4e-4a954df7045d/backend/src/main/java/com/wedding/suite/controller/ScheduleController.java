package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.ScheduleCheckRequest;
import com.wedding.suite.dto.request.ScheduleMoveRequest;
import com.wedding.suite.dto.response.ConflictResultVO;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.service.impl.ScheduleService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/schedule")
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    @GetMapping
    public ApiResponse<List<ScheduleTaskEntity>> list(
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Long storeId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return ApiResponse.ok(scheduleService.list(resourceType, storeId, from, to));
    }

    @PostMapping("/check")
    public ApiResponse<ConflictResultVO> check(@Valid @RequestBody ScheduleCheckRequest req) {
        return ApiResponse.ok(scheduleService.check(req));
    }

    @PutMapping("/{taskId}")
    public ApiResponse<ScheduleTaskEntity> move(@PathVariable Long taskId,
                                                 @Valid @RequestBody ScheduleMoveRequest req) {
        return ApiResponse.ok(scheduleService.move(taskId, req));
    }

    @DeleteMapping("/{taskId}")
    public ApiResponse<Map<String, Long>> remove(@PathVariable Long taskId) {
        scheduleService.remove(taskId);
        return ApiResponse.ok(Map.of("id", taskId));
    }
}
