package com.scriptkill.controller;

import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.player.PlayerProfileResponse;
import com.scriptkill.service.PlayerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/players")
@Tag(name = "player", description = "玩家档案、偏好分析")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    @GetMapping("/{userId}")
    @Operation(summary = "获取玩家档案", description = "查看玩家详细档案，包括偏好、评分、画像等")
    public ApiResponse<PlayerProfileResponse> getPlayerProfile(
            @Parameter(description = "用户ID") @PathVariable Long userId) {
        PlayerProfileResponse response = playerService.getPlayerProfile(userId);
        return ApiResponse.success(response);
    }
}
