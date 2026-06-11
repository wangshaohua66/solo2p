package com.glassstudio.controller;

import com.glassstudio.annotation.RateLimit;
import com.glassstudio.dto.FileInfoDTO;
import com.glassstudio.service.MinioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {

    private final MinioService minioService;

    @PostMapping("/upload")
    @RateLimit(key = "file:upload", limit = 10, window = 60)
    public ResponseEntity<FileInfoDTO> uploadFile(@RequestParam("file") MultipartFile file) {
        String originalFileName = file.getOriginalFilename();
        if (originalFileName == null || originalFileName.isEmpty()) {
            originalFileName = "unnamed_file";
        }

        Map<String, Object> result = minioService.uploadFile(originalFileName, file);

        FileInfoDTO fileInfo = FileInfoDTO.builder()
                .fileName((String) result.get("fileName"))
                .originalFileName((String) result.get("originalFileName"))
                .size((Long) result.get("size"))
                .url((String) result.get("url"))
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(fileInfo);
    }

    @PostMapping("/chunk/init")
    @RateLimit(key = "file:chunk:init", limit = 20, window = 60)
    public ResponseEntity<Map<String, String>> initChunkUpload() {
        String fileId = minioService.initChunkUpload();
        return ResponseEntity.ok(Map.of("fileId", fileId));
    }

    @PostMapping("/chunk")
    @RateLimit(key = "file:chunk:upload", limit = 100, window = 60)
    public ResponseEntity<Map<String, String>> uploadChunk(
            @RequestParam("fileId") String fileId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("totalChunks") int totalChunks,
            @RequestParam("chunk") MultipartFile chunk) throws IOException {
        byte[] data = chunk.getBytes();
        String message = minioService.uploadChunk(fileId, chunkIndex, data, totalChunks);
        return ResponseEntity.ok(Map.of("message", message));
    }

    @PostMapping("/chunk/complete")
    @RateLimit(key = "file:chunk:complete", limit = 10, window = 60)
    public ResponseEntity<FileInfoDTO> completeChunkUpload(
            @RequestParam("fileId") String fileId,
            @RequestParam("fileName") String fileName,
            @RequestParam("totalChunks") int totalChunks) {
        Map<String, Object> result = minioService.completeChunkUpload(fileId, fileName, totalChunks);

        FileInfoDTO fileInfo = FileInfoDTO.builder()
                .fileName((String) result.get("fileName"))
                .originalFileName((String) result.get("originalFileName"))
                .size((Long) result.get("size"))
                .url((String) result.get("url"))
                .build();

        return ResponseEntity.ok(fileInfo);
    }

    @GetMapping("/{fileName}/url")
    public ResponseEntity<Map<String, String>> getFileUrl(@PathVariable String fileName) {
        String url = minioService.getFileUrl(fileName);
        return ResponseEntity.ok(Map.of("url", url));
    }

    @DeleteMapping("/{fileName}")
    public ResponseEntity<Void> deleteFile(@PathVariable String fileName) {
        minioService.deleteFile(fileName);
        return ResponseEntity.noContent().build();
    }
}
