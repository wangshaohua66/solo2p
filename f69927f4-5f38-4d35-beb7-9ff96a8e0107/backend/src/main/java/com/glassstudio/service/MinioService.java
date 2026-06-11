package com.glassstudio.service;

import com.glassstudio.config.MinioConfig;
import com.glassstudio.exception.BusinessException;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;
    private final Map<String, List<byte[]>> chunkStorage = new ConcurrentHashMap<>();

    public Map<String, Object> uploadFile(String fileName, MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("文件大小不能超过10MB", HttpStatus.BAD_REQUEST);
        }

        String uniqueFileName = generateUniqueFileName(fileName);

        try (InputStream inputStream = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(minioConfig.getBucket())
                    .object(uniqueFileName)
                    .stream(inputStream, file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build());

            Map<String, Object> result = new HashMap<>();
            result.put("fileName", uniqueFileName);
            result.put("originalFileName", fileName);
            result.put("size", file.getSize());
            result.put("url", getFileUrl(uniqueFileName));
            return result;
        } catch (Exception e) {
            throw new BusinessException("文件上传失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String uploadChunk(String fileId, int chunkIndex, byte[] data, int totalChunks) {
        chunkStorage.computeIfAbsent(fileId, k -> new ArrayList<>(Collections.nCopies(totalChunks, null)));

        List<byte[]> chunks = chunkStorage.get(fileId);
        synchronized (chunks) {
            if (chunkIndex >= 0 && chunkIndex < totalChunks) {
                chunks.set(chunkIndex, data);
            }
        }

        return "分片 " + chunkIndex + " 上传成功";
    }

    public Map<String, Object> completeChunkUpload(String fileId, String fileName, int totalChunks) {
        List<byte[]> chunks = chunkStorage.get(fileId);
        if (chunks == null) {
            throw new BusinessException("文件上传会话不存在", HttpStatus.BAD_REQUEST);
        }

        synchronized (chunks) {
            for (int i = 0; i < totalChunks; i++) {
                if (chunks.get(i) == null) {
                    throw new BusinessException("分片 " + i + " 尚未上传", HttpStatus.BAD_REQUEST);
                }
            }
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            for (int i = 0; i < totalChunks; i++) {
                baos.write(chunks.get(i));
            }
            byte[] fileData = baos.toByteArray();

            if (fileData.length > MAX_FILE_SIZE) {
                throw new BusinessException("文件大小不能超过10MB", HttpStatus.BAD_REQUEST);
            }

            String uniqueFileName = generateUniqueFileName(fileName);

            try (InputStream inputStream = new ByteArrayInputStream(fileData)) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(minioConfig.getBucket())
                        .object(uniqueFileName)
                        .stream(inputStream, fileData.length, -1)
                        .build());
            }

            chunkStorage.remove(fileId);

            Map<String, Object> result = new HashMap<>();
            result.put("fileName", uniqueFileName);
            result.put("originalFileName", fileName);
            result.put("size", fileData.length);
            result.put("url", getFileUrl(uniqueFileName));
            return result;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("文件合并上传失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public String getFileUrl(String fileName) {
        try {
            return minioClient.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(minioConfig.getBucket())
                    .object(fileName)
                    .expiry(7, TimeUnit.DAYS)
                    .build());
        } catch (Exception e) {
            throw new BusinessException("获取文件URL失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public void deleteFile(String fileName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(minioConfig.getBucket())
                    .object(fileName)
                    .build());
        } catch (Exception e) {
            throw new BusinessException("文件删除失败: " + e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    public boolean fileExists(String fileName) {
        try {
            minioClient.statObject(StatObjectArgs.builder()
                    .bucket(minioConfig.getBucket())
                    .object(fileName)
                    .build());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private String generateUniqueFileName(String originalFileName) {
        String extension = "";
        int lastDotIndex = originalFileName.lastIndexOf('.');
        if (lastDotIndex > 0) {
            extension = originalFileName.substring(lastDotIndex);
        }
        return System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
    }

    public String initChunkUpload() {
        return UUID.randomUUID().toString();
    }
}
