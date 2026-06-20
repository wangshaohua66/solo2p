package com.design.collaboration.controller;

import com.design.collaboration.common.ApiResponse;
import com.design.collaboration.dto.ProjectCreateRequest;
import com.design.collaboration.entity.Project;
import com.design.collaboration.entity.ProjectLog;
import com.design.collaboration.entity.ProjectProfessional;
import com.design.collaboration.enums.ProjectStatus;
import com.design.collaboration.enums.ProjectType;
import com.design.collaboration.service.ProjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/project")
@Tag(name = "项目管理", description = "项目增删改查、专业负责人分配、项目日志")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @GetMapping("/statistics")
    @Operation(summary = "获取项目统计数据")
    public ApiResponse<Map<String, Long>> getStatistics() {
        return ApiResponse.success(projectService.getStatistics());
    }

    @GetMapping("/{id}")
    @Operation(summary = "根据ID获取项目")
    public ApiResponse<Project> getById(@Parameter(description = "项目ID") @PathVariable Long id) {
        Project project = projectService.findById(id);
        if (project == null) {
            return ApiResponse.error("项目不存在");
        }
        return ApiResponse.success(project);
    }

    @GetMapping("/list")
    @Operation(summary = "项目列表查询")
    public ApiResponse<List<Project>> list(
            @Parameter(description = "关键词") @RequestParam(required = false) String keyword,
            @Parameter(description = "项目类型") @RequestParam(required = false) ProjectType type,
            @Parameter(description = "项目状态") @RequestParam(required = false) ProjectStatus status,
            @Parameter(description = "开始日期") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "结束日期") @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        return ApiResponse.success(projectService.findByConditions(keyword, type, status, startDate, endDate));
    }

    @PostMapping
    @Operation(summary = "创建项目")
    public ApiResponse<Project> create(@Valid @RequestBody ProjectCreateRequest request, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("创建成功", projectService.create(request, userId));
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新项目")
    public ApiResponse<Project> update(@Parameter(description = "项目ID") @PathVariable Long id,
                                       @Valid @RequestBody ProjectCreateRequest request,
                                       HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("更新成功", projectService.update(id, request, userId));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除项目")
    public ApiResponse<Void> delete(@Parameter(description = "项目ID") @PathVariable Long id, HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        if (projectService.delete(id, userId)) {
            return ApiResponse.success("删除成功", null);
        }
        return ApiResponse.error("删除失败");
    }

    @GetMapping("/{id}/professionals")
    @Operation(summary = "获取项目专业负责人列表")
    public ApiResponse<List<ProjectProfessional>> listProfessionals(@Parameter(description = "项目ID") @PathVariable Long id) {
        return ApiResponse.success(projectService.findProfessionalsByProjectId(id));
    }

    @PostMapping("/{id}/professionals")
    @Operation(summary = "分配项目专业负责人")
    public ApiResponse<ProjectProfessional> assignProfessional(
            @Parameter(description = "项目ID") @PathVariable Long id,
            @RequestBody ProjectProfessional pp,
            HttpServletRequest req) {
        Long userId = (Long) req.getAttribute("userId");
        return ApiResponse.success("分配成功", projectService.assignProfessional(id, pp, userId));
    }

    @GetMapping("/{id}/logs")
    @Operation(summary = "获取项目动态日志")
    public ApiResponse<List<ProjectLog>> listLogs(@Parameter(description = "项目ID") @PathVariable Long id) {
        return ApiResponse.success(projectService.findLogsByProjectId(id));
    }
}
