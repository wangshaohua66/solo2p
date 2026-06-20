package com.tvstation.media.controller;

import com.tvstation.media.common.ApiResponse;
import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ScheduleItem;
import com.tvstation.media.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/schedule")
@RequiredArgsConstructor
@Tag(name = "排期管理", description = "播出排期相关接口")
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping
    @Operation(summary = "获取排期")
    public ApiResponse<List<ScheduleItem>> getSchedule(
            @RequestParam String channelId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {

        List<ScheduleItem> items = scheduleService.getSchedule(channelId, date);
        return ApiResponse.success(items);
    }

    @GetMapping("/list")
    @Operation(summary = "获取排期列表（分页）")
    public ApiResponse<PageResult<ScheduleItem>> getScheduleList(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String channelId,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate) {

        Pageable pageable = PageRequest.of(page - 1, pageSize, Sort.by(Sort.Direction.ASC, "scheduleDate", "sortOrder"));
        PageResult<ScheduleItem> result = scheduleService.getScheduleList(channelId, startDate, endDate, pageable);
        return ApiResponse.success(result, result.getTotal());
    }

    @PostMapping
    @Operation(summary = "创建排期")
    public ApiResponse<ScheduleItem> createSchedule(
            @RequestBody ScheduleItem scheduleItem,
            @RequestHeader("userName") String userName) {

        ScheduleItem created = scheduleService.createSchedule(scheduleItem, userName);
        return ApiResponse.success("排期创建成功", created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新排期")
    public ApiResponse<ScheduleItem> updateSchedule(
            @PathVariable Long id,
            @RequestBody ScheduleItem scheduleItem,
            @RequestHeader("userId") Long userId) {

        ScheduleItem updated = scheduleService.updateSchedule(id, scheduleItem, userId);
        return ApiResponse.success("排期更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除排期")
    public ApiResponse<Void> deleteSchedule(@PathVariable Long id, @RequestHeader("userId") Long userId) {
        scheduleService.deleteSchedule(id, userId);
        return ApiResponse.success("排期删除成功", null);
    }

    @PutMapping("/reorder")
    @Operation(summary = "重新排序")
    public ApiResponse<Void> reorderSchedule(@RequestBody Map<String, Object> data) {
        String channelId = (String) data.get("channelId");
        String date = (String) data.get("date");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");

        scheduleService.reorderSchedule(channelId, date, items);
        return ApiResponse.success("排序更新成功", null);
    }

    @GetMapping("/export")
    @Operation(summary = "导出排期")
    public void exportSchedule(
            @RequestParam String channelId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam String format,
            HttpServletResponse response) throws IOException {

        byte[] data = scheduleService.exportSchedule(channelId, startDate, endDate, format);
        String fileName = URLEncoder.encode("节目单." + format, StandardCharsets.UTF_8);

        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + fileName);
        response.getOutputStream().write(data);
        response.getOutputStream().flush();
    }

    @PostMapping("/import")
    @Operation(summary = "导入排期")
    public ApiResponse<List<ScheduleItem>> importSchedule(
            @RequestParam("file") MultipartFile file,
            @RequestParam String channelId,
            @RequestParam String date,
            @RequestHeader("userId") Long userId) throws Exception {

        List<ScheduleItem> items = scheduleService.importSchedule(file, channelId, date, userId);
        return ApiResponse.success("导入成功，共导入 " + items.size() + " 条节目", items);
    }

    @PostMapping("/sync-broadcast")
    @Operation(summary = "同步播出系统")
    public ApiResponse<Map<String, Object>> syncWithBroadcastSystem(@RequestBody Map<String, Object> data) {
        @SuppressWarnings("unchecked")
        List<Long> scheduleIds = (List<Long>) data.get("scheduleIds");
        Map<String, Object> result = scheduleService.syncWithBroadcastSystem(scheduleIds);
        return ApiResponse.success("同步成功", result);
    }

    @GetMapping("/gaps")
    @Operation(summary = "检测空档")
    public ApiResponse<List<Map<String, Object>>> detectGaps(
            @RequestParam String channelId,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate date) {

        List<Map<String, Object>> gaps = scheduleService.detectGaps(channelId, date);
        return ApiResponse.success(gaps);
    }

    @GetMapping("/statistics")
    @Operation(summary = "排期统计")
    public ApiResponse<Map<String, Object>> getScheduleStatistics(
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate) {

        return ApiResponse.success(scheduleService.getScheduleStatistics(startDate, endDate));
    }
}
