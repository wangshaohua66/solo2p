package com.heritage.restoration.controller;

import com.heritage.restoration.common.Result;
import com.heritage.restoration.dto.ProgressUpdateDTO;
import com.heritage.restoration.dto.ProjectCreateDTO;
import com.heritage.restoration.dto.ProjectSearchDTO;
import com.heritage.restoration.entity.RestorationMaterial;
import com.heritage.restoration.entity.RestorationPhoto;
import com.heritage.restoration.entity.RestorationProject;
import com.heritage.restoration.service.RestorationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
public class RestorationController {

    private final RestorationService service;

    private String userId(HttpServletRequest req) {
        return req.getHeader("X-User-Id") != null ? req.getHeader("X-User-Id") : "system";
    }
    private String userName(HttpServletRequest req) {
        return req.getHeader("X-Username") != null ? req.getHeader("X-Username") : "System";
    }

    @PostMapping
    public Result<RestorationProject> create(@Valid @RequestBody ProjectCreateDTO dto, HttpServletRequest req) {
        return Result.ok(service.create(dto, userId(req), userName(req)));
    }

    @PutMapping("/{id}")
    public Result<RestorationProject> update(@PathVariable String id, @Valid @RequestBody ProjectCreateDTO dto) {
        return Result.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        service.delete(id);
        return Result.ok();
    }

    @GetMapping("/{id}")
    public Result<RestorationProject> getById(@PathVariable String id) {
        return Result.ok(service.getById(id));
    }

    @PostMapping("/search")
    public Result<Page<RestorationProject>> search(@RequestBody ProjectSearchDTO dto) {
        return Result.ok(service.search(dto));
    }

    @GetMapping
    public Result<Page<RestorationProject>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String artifactId,
            @RequestParam(required = false) String supervisorId) {
        ProjectSearchDTO dto = new ProjectSearchDTO();
        dto.setPage(page); dto.setSize(size);
        dto.setKeyword(keyword);
        if (status != null) {
            try {
                dto.setStatus(com.heritage.restoration.enums.ProjectStatus.valueOf(status));
            } catch (Exception ignored) {}
        }
        dto.setArtifactId(artifactId);
        dto.setSupervisorId(supervisorId);
        return Result.ok(service.search(dto));
    }

    @PutMapping("/{id}/status")
    public Result<RestorationProject> updateStatus(@PathVariable String id,
                                                    @RequestParam String status,
                                                    HttpServletRequest req) {
        return Result.ok(service.updateStatus(id, status, userId(req), userName(req)));
    }

    @PostMapping("/{id}/progress")
    public Result<RestorationProject> updateProgress(@PathVariable String id,
                                                      @Valid @RequestBody ProgressUpdateDTO dto,
                                                      HttpServletRequest req) {
        return Result.ok(service.updateProgress(id, dto, userId(req), userName(req)));
    }

    @GetMapping("/{id}/logs")
    public Result<List<Map<String, Object>>> logs(@PathVariable String id) {
        return Result.ok(service.getLogs(id));
    }

    @PostMapping("/{id}/materials")
    public Result<RestorationMaterial> addMaterial(@PathVariable String id,
                                                    @RequestBody RestorationMaterial material,
                                                    HttpServletRequest req) {
        return Result.ok(service.addMaterial(id, material, userId(req)));
    }

    @GetMapping("/{id}/materials")
    public Result<List<RestorationMaterial>> materials(@PathVariable String id) {
        return Result.ok(service.listMaterials(id));
    }

    @DeleteMapping("/materials/{mid}")
    public Result<Void> removeMaterial(@PathVariable String mid) {
        service.removeMaterial(mid);
        return Result.ok();
    }

    @PostMapping("/{id}/photos")
    public Result<RestorationPhoto> addPhoto(@PathVariable String id,
                                             @RequestPart("file") MultipartFile file,
                                             @RequestParam(required = false) String stage,
                                             @RequestParam(required = false) String description,
                                             HttpServletRequest req) {
        RestorationPhoto p = new RestorationPhoto();
        p.setStage(stage);
        p.setDescription(description);
        p.setFileName(file.getOriginalFilename());
        p.setFileSize(file.getSize());
        p.setUploaderId(userId(req));
        p.setUploaderName(userName(req));
        p.setObjectUrl("/api/restoration/projects/" + id + "/photos/storage/" + System.currentTimeMillis());
        return Result.ok(service.addPhoto(id, p));
    }

    @PostMapping("/{id}/photos/batch")
    public Result<RestorationPhoto> addPhotoDirect(@PathVariable String id, @RequestBody RestorationPhoto photo) {
        return Result.ok(service.addPhoto(id, photo));
    }

    @GetMapping("/{id}/photos")
    public Result<List<RestorationPhoto>> photos(@PathVariable String id,
                                                  @RequestParam(required = false) String stage) {
        if (stage != null) return Result.ok(service.listPhotosByStage(id, stage));
        return Result.ok(service.listPhotos(id));
    }

    @DeleteMapping("/photos/{pid}")
    public Result<Void> removePhoto(@PathVariable String pid) {
        service.removePhoto(pid);
        return Result.ok();
    }

    @GetMapping("/stats/overview")
    public Result<Map<String, Object>> stats() {
        return Result.ok(service.getStats());
    }

    @GetMapping("/{id}/full")
    public Result<Map<String, Object>> fullDetail(@PathVariable String id) {
        Map<String, Object> result = new HashMap<>();
        result.put("project", service.getById(id));
        result.put("logs", service.getLogs(id));
        result.put("materials", service.listMaterials(id));
        result.put("photos", service.listPhotos(id));
        Map<String, List<RestorationPhoto>> byStage = new HashMap<>();
        byStage.put("BEFORE", service.listPhotosByStage(id, "BEFORE"));
        byStage.put("IN_PROGRESS", service.listPhotosByStage(id, "IN_PROGRESS"));
        byStage.put("AFTER", service.listPhotosByStage(id, "AFTER"));
        result.put("photosByStage", byStage);
        return Result.ok(result);
    }
}
