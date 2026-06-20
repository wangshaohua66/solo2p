package com.tvstation.media.service.impl;

import com.tvstation.media.service.ChunkedUploadService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class ChunkedUploadServiceImpl implements ChunkedUploadService {

    @Value("${app.upload.temp-dir:/tmp/tvstation-uploads}")
    private String tempDir;

    private Path tempPath;

    private final Map<String, UploadSession> sessions = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        try {
            tempPath = Paths.get(tempDir);
            if (!Files.exists(tempPath)) {
                Files.createDirectories(tempPath);
            }
            log.info("Chunked upload temp directory: {}", tempPath.toAbsolutePath());
        } catch (IOException e) {
            log.error("Failed to create temp upload directory", e);
        }
    }

    @PreDestroy
    public void cleanup() {
        sessions.clear();
    }

    @Override
    public Map<String, Object> initUpload(String uploadId, String fileName, long fileSize,
                                           String fileType, int totalChunks, int chunkSize,
                                           List<String> tags, String description) {
        UploadSession session = new UploadSession();
        session.setUploadId(uploadId);
        session.setFileName(fileName);
        session.setFileSize(fileSize);
        session.setFileType(fileType);
        session.setTotalChunks(totalChunks);
        session.setChunkSize(chunkSize);
        session.setTags(tags != null ? tags : new ArrayList<>());
        session.setDescription(description);
        session.setUploadedChunks(new HashSet<>());
        session.setCreatedAt(LocalDateTime.now());
        session.setStatus("uploading");

        sessions.put(uploadId, session);

        Path sessionDir = tempPath.resolve(uploadId);
        try {
            Files.createDirectories(sessionDir);
        } catch (IOException e) {
            log.error("Failed to create session directory: {}", sessionDir, e);
        }

        log.info("Upload session initialized: uploadId={}, fileName={}, totalChunks={}",
                uploadId, fileName, totalChunks);

        Map<String, Object> result = new HashMap<>();
        result.put("uploadId", uploadId);
        result.put("status", "initialized");
        result.put("totalChunks", totalChunks);
        return result;
    }

    @Override
    public Map<String, Object> uploadChunk(String uploadId, int chunkIndex, int totalChunks,
                                           String fileName, byte[] chunkData) {
        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            session = new UploadSession();
            session.setUploadId(uploadId);
            session.setFileName(fileName);
            session.setTotalChunks(totalChunks);
            session.setUploadedChunks(new HashSet<>());
            session.setCreatedAt(LocalDateTime.now());
            session.setStatus("uploading");
            sessions.put(uploadId, session);

            Path sessionDir = tempPath.resolve(uploadId);
            try {
                Files.createDirectories(sessionDir);
            } catch (IOException e) {
                log.error("Failed to create session directory", e);
            }
        }

        Path chunkFile = tempPath.resolve(uploadId).resolve("chunk_" + chunkIndex);
        try {
            Files.write(chunkFile, chunkData);
            session.getUploadedChunks().add(chunkIndex);
            session.setUpdatedAt(LocalDateTime.now());

            log.debug("Chunk uploaded: uploadId={}, chunkIndex={}/{}, uploaded={}",
                    uploadId, chunkIndex, totalChunks - 1, session.getUploadedChunks().size());
        } catch (IOException e) {
            log.error("Failed to write chunk: uploadId={}, chunkIndex={}", uploadId, chunkIndex, e);
            throw new RuntimeException("Failed to save chunk", e);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("uploadId", uploadId);
        result.put("chunkIndex", chunkIndex);
        result.put("uploadedChunks", session.getUploadedChunks().size());
        result.put("totalChunks", session.getTotalChunks());
        result.put("progress", Math.round((session.getUploadedChunks().size() * 100.0) / session.getTotalChunks()));
        return result;
    }

    @Override
    public Map<String, Object> mergeChunks(String uploadId, String fileName, long fileSize,
                                            String fileType, int totalChunks,
                                            List<String> tags, String description) {
        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            session = new UploadSession();
            session.setUploadId(uploadId);
            session.setFileName(fileName);
            session.setFileSize(fileSize);
            session.setFileType(fileType);
            session.setTotalChunks(totalChunks);
            session.setTags(tags != null ? tags : new ArrayList<>());
            session.setDescription(description);
            session.setUploadedChunks(new HashSet<>());
            session.setCreatedAt(LocalDateTime.now());

            Path sessionDir = tempPath.resolve(uploadId);
            if (Files.exists(sessionDir)) {
                try {
                    for (int i = 0; i < totalChunks; i++) {
                        Path chunkFile = sessionDir.resolve("chunk_" + i);
                        if (Files.exists(chunkFile)) {
                            session.getUploadedChunks().add(i);
                        }
                    }
                } catch (Exception e) {
                    log.error("Failed to scan existing chunks", e);
                }
            }
            sessions.put(uploadId, session);
        }

        session.setStatus("merging");
        session.setUpdatedAt(LocalDateTime.now());

        if (session.getUploadedChunks().size() < session.getTotalChunks()) {
            log.warn("Merge attempt with incomplete chunks: uploaded={}, expected={}",
                    session.getUploadedChunks().size(), session.getTotalChunks());
            Map<String, Object> result = new HashMap<>();
            result.put("uploadId", uploadId);
            result.put("status", "incomplete");
            result.put("uploadedChunks", session.getUploadedChunks().size());
            result.put("totalChunks", session.getTotalChunks());
            return result;
        }

        Path sessionDir = tempPath.resolve(uploadId);
        Path mergedFile = sessionDir.resolve("merged_" + fileName);

        try (OutputStream out = Files.newOutputStream(mergedFile, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
            for (int i = 0; i < session.getTotalChunks(); i++) {
                Path chunkFile = sessionDir.resolve("chunk_" + i);
                if (Files.exists(chunkFile)) {
                    Files.copy(chunkFile, out);
                }
            }
        } catch (IOException e) {
            log.error("Failed to merge chunks: uploadId={}", uploadId, e);
            session.setStatus("failed");
            throw new RuntimeException("Failed to merge chunks", e);
        }

        long actualSize = 0;
        try {
            actualSize = Files.size(mergedFile);
        } catch (IOException ignored) {}

        session.setStatus("completed");
        session.setUpdatedAt(LocalDateTime.now());

        log.info("Chunks merged successfully: uploadId={}, fileName={}, mergedSize={}",
                uploadId, fileName, actualSize);

        cleanupSession(uploadId, sessionDir);

        Map<String, Object> result = new HashMap<>();
        result.put("uploadId", uploadId);
        result.put("status", "completed");
        result.put("fileName", fileName);
        result.put("fileSize", actualSize);
        result.put("mergedPath", mergedFile.toString());
        result.put("tags", session.getTags());
        result.put("description", session.getDescription());
        return result;
    }

    @Override
    public Map<String, Object> getUploadStatus(String uploadId) {
        UploadSession session = sessions.get(uploadId);
        if (session == null) {
            Map<String, Object> result = new HashMap<>();
            result.put("uploadId", uploadId);
            result.put("status", "not_found");
            return result;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("uploadId", uploadId);
        result.put("status", session.getStatus());
        result.put("fileName", session.getFileName());
        result.put("fileSize", session.getFileSize());
        result.put("totalChunks", session.getTotalChunks());
        result.put("uploadedChunks", session.getUploadedChunks().size());
        result.put("progress", Math.round((session.getUploadedChunks().size() * 100.0) / session.getTotalChunks()));
        return result;
    }

    @Override
    public void cancelUpload(String uploadId) {
        UploadSession session = sessions.remove(uploadId);
        if (session != null) {
            session.setStatus("cancelled");
        }

        Path sessionDir = tempPath.resolve(uploadId);
        cleanupSession(uploadId, sessionDir);
        log.info("Upload cancelled: uploadId={}", uploadId);
    }

    @Scheduled(fixedRate = 3600000)
    @Override
    public void cleanupExpiredUploads() {
        LocalDateTime threshold = LocalDateTime.now().minusHours(24);
        List<String> expiredIds = new ArrayList<>();

        sessions.forEach((id, session) -> {
            if (session.getUpdatedAt() != null && session.getUpdatedAt().isBefore(threshold)) {
                expiredIds.add(id);
            }
        });

        for (String id : expiredIds) {
            cancelUpload(id);
        }

        if (!expiredIds.isEmpty()) {
            log.info("Cleaned up {} expired upload sessions", expiredIds.size());
        }
    }

    private void cleanupSession(String uploadId, Path sessionDir) {
        try {
            if (Files.exists(sessionDir)) {
                Files.walk(sessionDir)
                        .sorted(Comparator.reverseOrder())
                        .forEach(path -> {
                            try {
                                Files.delete(path);
                            } catch (IOException e) {
                                log.warn("Failed to delete: {}", path);
                            }
                        });
            }
        } catch (IOException e) {
            log.warn("Failed to cleanup session directory: {}", sessionDir);
        }
        sessions.remove(uploadId);
    }

    private static class UploadSession {
        private String uploadId;
        private String fileName;
        private long fileSize;
        private String fileType;
        private int totalChunks;
        private int chunkSize;
        private Set<Integer> uploadedChunks;
        private List<String> tags;
        private String description;
        private String status;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public String getUploadId() { return uploadId; }
        public void setUploadId(String uploadId) { this.uploadId = uploadId; }
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        public long getFileSize() { return fileSize; }
        public void setFileSize(long fileSize) { this.fileSize = fileSize; }
        public String getFileType() { return fileType; }
        public void setFileType(String fileType) { this.fileType = fileType; }
        public int getTotalChunks() { return totalChunks; }
        public void setTotalChunks(int totalChunks) { this.totalChunks = totalChunks; }
        public int getChunkSize() { return chunkSize; }
        public void setChunkSize(int chunkSize) { this.chunkSize = chunkSize; }
        public Set<Integer> getUploadedChunks() { return uploadedChunks; }
        public void setUploadedChunks(Set<Integer> uploadedChunks) { this.uploadedChunks = uploadedChunks; }
        public List<String> getTags() { return tags; }
        public void setTags(List<String> tags) { this.tags = tags; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
        public LocalDateTime getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    }
}
