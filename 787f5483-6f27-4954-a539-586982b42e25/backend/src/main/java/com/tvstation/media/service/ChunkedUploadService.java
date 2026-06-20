package com.tvstation.media.service;

import java.util.List;
import java.util.Map;

public interface ChunkedUploadService {

    Map<String, Object> initUpload(String uploadId, String fileName, long fileSize,
                                    String fileType, int totalChunks, int chunkSize,
                                    List<String> tags, String description);

    Map<String, Object> uploadChunk(String uploadId, int chunkIndex, int totalChunks,
                                    String fileName, byte[] chunkData);

    Map<String, Object> mergeChunks(String uploadId, String fileName, long fileSize,
                                     String fileType, int totalChunks,
                                     List<String> tags, String description);

    Map<String, Object> getUploadStatus(String uploadId);

    void cancelUpload(String uploadId);

    void cleanupExpiredUploads();
}
