package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.entity.ApprenticeRecord;
import com.heritage.entity.Inheritor;
import com.heritage.entity.TrainingSchedule;
import com.heritage.service.InheritorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inheritors")
@Tag(name = "传承人管理", description = "传承人档案与传承关系管理API")
public class InheritorController {

    @Autowired
    private InheritorService inheritorService;

    @GetMapping("/public/list")
    @Operation(summary = "公开查询传承人列表")
    public ApiResponse<Page<Inheritor>> getPublicInheritors(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Inheritor> result = inheritorService.searchInheritors(keyword, region, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/public/{id}")
    @Operation(summary = "公开获取传承人详情")
    public ApiResponse<Inheritor> getPublicInheritorDetail(@PathVariable String id) {
        return inheritorService.findById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "传承人不存在"));
    }

    @GetMapping("/public/heritage/{heritageId}")
    @Operation(summary = "根据非遗项目查询传承人")
    public ApiResponse<List<Inheritor>> getInheritorsByHeritage(@PathVariable String heritageId) {
        return ApiResponse.success(inheritorService.findByHeritageId(heritageId));
    }

    @GetMapping("/public/tree/{inheritorId}")
    @Operation(summary = "获取传承关系图谱", description = "获取包括师父、徒弟在内的完整传承关系链")
    public ApiResponse<List<Inheritor>> getInheritanceTree(@PathVariable String inheritorId) {
        return ApiResponse.success(inheritorService.getInheritanceTree(inheritorId));
    }

    @GetMapping
    @Operation(summary = "管理端查询传承人列表")
    public ApiResponse<Page<Inheritor>> getInheritors(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String region,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        Pageable pageable = PageRequest.of(page, size);
        Page<Inheritor> result = inheritorService.searchInheritors(keyword, region, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取传承人详情")
    public ApiResponse<Inheritor> getInheritorById(@PathVariable String id) {
        return inheritorService.findById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "传承人不存在"));
    }

    @PostMapping
    @Operation(summary = "创建传承人档案")
    public ApiResponse<Inheritor> createInheritor(@RequestBody Inheritor inheritor) {
        Inheritor created = inheritorService.createInheritor(inheritor);
        return ApiResponse.success("创建成功", created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新传承人档案")
    public ApiResponse<Inheritor> updateInheritor(
            @PathVariable String id,
            @RequestBody Inheritor inheritor) {
        Inheritor updated = inheritorService.updateInheritor(id, inheritor);
        return ApiResponse.success("更新成功", updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除传承人档案")
    public ApiResponse<Void> deleteInheritor(@PathVariable String id) {
        inheritorService.deleteInheritor(id);
        return ApiResponse.success("删除成功", null);
    }

    @PostMapping("/{id}/apprentice")
    @Operation(summary = "添加收徒记录")
    public ApiResponse<Inheritor> addApprenticeRecord(
            @PathVariable String id,
            @RequestBody ApprenticeRecord record) {
        Inheritor updated = inheritorService.addApprenticeRecord(id, record);
        return ApiResponse.success("添加成功", updated);
    }

    @PostMapping("/{id}/schedule")
    @Operation(summary = "添加可预约档期")
    public ApiResponse<Inheritor> addAvailableSchedule(
            @PathVariable String id,
            @RequestBody TrainingSchedule schedule) {
        Inheritor updated = inheritorService.addAvailableSchedule(id, schedule);
        return ApiResponse.success("添加成功", updated);
    }

    @GetMapping("/{id}/schedules")
    @Operation(summary = "获取传承人可预约档期")
    public ApiResponse<List<TrainingSchedule>> getAvailableSchedules(@PathVariable String id) {
        return ApiResponse.success(inheritorService.getAvailableSchedules(id));
    }
}
