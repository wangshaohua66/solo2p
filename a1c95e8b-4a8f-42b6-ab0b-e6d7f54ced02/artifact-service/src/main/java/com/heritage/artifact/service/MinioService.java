package com.heritage.artifact.service;

import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;
    private final com.heritage.artifact.config.MinioConfig minioConfig;

    public String uploadFile(MultipartFile file, String objectName) {
        try {
            ensureBucketExists();
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(minioConfig.getBucketName())
                    .object(objectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .contentType(file.getContentType())
                    .build()
            );
            log.debug("File uploaded successfully: {}", objectName);
            return getFileUrl(objectName);
        } catch (Exception e) {
            log.error("Failed to upload file: {}", e.getMessage());
            throw new RuntimeException("文件上传失败: " + e.getMessage());
        }
    }

    public String uploadStream(InputStream inputStream, String objectName, String contentType, long size) {
        try {
            ensureBucketExists();
            minioClient.putObject(
                PutObjectArgs.builder()
                    .bucket(minioConfig.getBucketName())
                    .object(objectName)
                    .stream(inputStream, size, -1)
                    .contentType(contentType)
                    .build()
            );
            return getFileUrl(objectName);
        } catch (Exception e) {
            log.error("Failed to upload stream: {}", e.getMessage());
            throw new RuntimeException("流上传失败: " + e.getMessage());
        }
    }

    public InputStream downloadFile(String objectName) {
        try {
            return minioClient.getObject(
                GetObjectArgs.builder()
                    .bucket(minioConfig.getBucketName())
                    .object(objectName)
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to download file: {}", e.getMessage());
            throw new RuntimeException("文件下载失败: " + e.getMessage());
        }
    }

    public void deleteFile(String objectName) {
        try {
            minioClient.removeObject(
                RemoveObjectArgs.builder()
                    .bucket(minioConfig.getBucketName())
                    .object(objectName)
                    .build()
            );
            log.debug("File deleted: {}", objectName);
        } catch (Exception e) {
            log.error("Failed to delete file: {}", e.getMessage());
        }
    }

    public String getFileUrl(String objectName) {
        return String.format("%s/%s/%s", minioConfig.getEndpoint(), minioConfig.getBucketName(), objectName);
    }

    public String getPresignedUrl(String objectName, int durationMinutes) {
        try {
            return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET)
                    .bucket(minioConfig.getBucketName())
                    .object(objectName)
                    .expiry(durationMinutes, TimeUnit.MINUTES)
                    .build()
            );
        } catch (Exception e) {
            log.error("Failed to get presigned url: {}", e.getMessage());
            throw new RuntimeException("获取预览链接失败: " + e.getMessage());
        }
    }

    private void ensureBucketExists() {
        try {
            boolean exists = minioClient.bucketExists(
                BucketExistsArgs.builder().bucket(minioConfig.getBucketName()).build()
            );
            if (!exists) {
                minioClient.makeBucket(
                    MakeBucketArgs.builder().bucket(minioConfig.getBucketName()).build()
                );
                log.info("Bucket created: {}", minioConfig.getBucketName());
            }
        } catch (Exception e) {
            log.error("Failed to check/create bucket: {}", e.getMessage());
        }
    }
}
