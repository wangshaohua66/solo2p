package com.heritage.artifact.controller;

import com.heritage.artifact.common.Result;
import com.heritage.artifact.dto.ArtifactSearchDTO;
import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.entity.ArtifactDocument;
import com.heritage.artifact.entity.ArtifactImage;
import com.heritage.artifact.entity.ArtifactModel3D;
import com.heritage.artifact.service.ArtifactSearchService;
import com.heritage.artifact.service.ArtifactService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
@RequiredArgsConstructor
public class ArtifactController {

    private final ArtifactService artifactService;
    private final ArtifactSearchService artifactSearchService;

    @GetMapping({"/{id}", "/artifacts/{id}"})
    public Result<Artifact> getArtifactById(@PathVariable String id) {
        return Result.success(artifactService.getArtifactById(id));
    }

    @PutMapping({"/{id}/status", "/artifacts/{id}/status"})
    public Result<Void> updateStatusByPut(@PathVariable String id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isEmpty()) return Result.fail("status 不能为空");
        artifactService.updateStatus(id, status);
        return Result.success(null);
    }

    @PostMapping("/artifacts")
    public Result<Artifact> createArtifact(@RequestBody Artifact artifact) {
        return Result.success(artifactService.createArtifact(artifact));
    }

    @PutMapping("/artifacts/{id}")
    public Result<Artifact> updateArtifact(@PathVariable String id, @RequestBody Artifact artifact) {
        return Result.success(artifactService.updateArtifact(id, artifact));
    }

    @DeleteMapping("/artifacts/{id}")
    public Result<Void> deleteArtifact(@PathVariable String id) {
        artifactService.deleteArtifact(id);
        return Result.success(null);
    }

    @GetMapping("/artifacts/code/{code}")
    public Result<Artifact> getArtifactByCode(@PathVariable String code) {
        return Result.success(artifactService.getArtifactByCode(code));
    }

    @PostMapping({"/search", "/artifacts/search"})
    public Result<Page<Artifact>> searchArtifacts(@RequestBody ArtifactSearchDTO searchDTO) {
        return Result.success(artifactService.searchArtifacts(searchDTO));
    }

    @GetMapping("/artifacts/type/{type}")
    public Result<List<Artifact>> getArtifactsByType(@PathVariable String type) {
        return Result.success(artifactService.getArtifactsByType(type));
    }

    @GetMapping("/artifacts/level/{level}")
    public Result<List<Artifact>> getArtifactsByLevel(@PathVariable String level) {
        return Result.success(artifactService.getArtifactsByLevel(level));
    }

    @GetMapping("/artifacts/status/{status}")
    public Result<List<Artifact>> getArtifactsByStatus(@PathVariable String status) {
        return Result.success(artifactService.getArtifactsByStatus(status));
    }

    @PostMapping("/artifacts/{artifactId}/images")
    public Result<ArtifactImage> uploadImage(
        @PathVariable String artifactId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "description", required = false) String description,
        @RequestParam(value = "isCover", defaultValue = "false") boolean isCover
    ) {
        return Result.success(artifactService.uploadImage(artifactId, file, description, isCover));
    }

    @DeleteMapping("/artifacts/{artifactId}/images/{imageId}")
    public Result<Void> deleteImage(@PathVariable String artifactId, @PathVariable String imageId) {
        artifactService.deleteImage(artifactId, imageId);
        return Result.success(null);
    }

    @PostMapping("/artifacts/{artifactId}/models3d")
    public Result<ArtifactModel3D> uploadModel3D(
        @PathVariable String artifactId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "format", required = false) String format,
        @RequestParam(value = "description", required = false) String description
    ) {
        return Result.success(artifactService.uploadModel3D(artifactId, file, format, description));
    }

    @DeleteMapping("/artifacts/{artifactId}/models3d/{modelId}")
    public Result<Void> deleteModel3D(@PathVariable String artifactId, @PathVariable String modelId) {
        artifactService.deleteModel3D(artifactId, modelId);
        return Result.success(null);
    }

    @PostMapping("/artifacts/{artifactId}/documents")
    public Result<ArtifactDocument> uploadDocument(
        @PathVariable String artifactId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "category", required = false) String category,
        @RequestParam(value = "description", required = false) String description
    ) {
        return Result.success(artifactService.uploadDocument(artifactId, file, category, description));
    }

    @DeleteMapping("/artifacts/{artifactId}/documents/{documentId}")
    public Result<Void> deleteDocument(@PathVariable String artifactId, @PathVariable String documentId) {
        artifactService.deleteDocument(artifactId, documentId);
        return Result.success(null);
    }

    @PatchMapping("/artifacts/{id}/status")
    public Result<Artifact> updateStatus(@PathVariable String id, @RequestParam String status) {
        return Result.success(artifactService.updateStatus(id, status));
    }

    @GetMapping("/artifacts/code/generate")
    public Result<String> generateArtifactCode() {
        return Result.success(artifactService.generateArtifactCode());
    }

    @GetMapping({"/count", "/artifacts/count"})
    public Result<Long> countArtifacts() {
        return Result.success(artifactService.countArtifacts());
    }

    @PostMapping("/admin/es/reindex")
    public Result<Map<String, Object>> reindexElasticsearch() {
        long t0 = System.nanoTime();
        long count = artifactSearchService.fullReindex();
        long costMs = (System.nanoTime() - t0) / 1_000_000L;
        return Result.success(Map.of("count", count, "costMs", costMs));
    }

    @GetMapping("/admin/es/stats")
    public Result<Map<String, Object>> esStats() {
        return Result.success(Map.of(
            "totalCount", artifactService.countArtifacts(),
            "backend", "elasticsearch",
            "fallbackEnabled", true
        ));
    }
}
