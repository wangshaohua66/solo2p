package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.FollowTaskStatusRequest;
import com.wedding.suite.dto.response.FollowupDetailVO;
import com.wedding.suite.entity.FollowTaskEntity;
import com.wedding.suite.service.impl.FollowupService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/followup")
public class FollowupController {

    private final FollowupService followupService;

    public FollowupController(FollowupService followupService) {
        this.followupService = followupService;
    }

    @GetMapping("/{weddingId}")
    public ApiResponse<FollowupDetailVO> detail(@PathVariable Long weddingId) {
        return ApiResponse.ok(followupService.detail(weddingId));
    }

    @GetMapping("/tasks")
    public ApiResponse<List<FollowTaskEntity>> list() {
        return ApiResponse.ok(followupService.list());
    }

    @PutMapping("/tasks/{taskId}")
    public ApiResponse<FollowTaskEntity> updateTask(@PathVariable Long taskId,
                                                     @Valid @RequestBody FollowTaskStatusRequest req) {
        return ApiResponse.ok(followupService.updateTask(taskId, req));
    }
}
