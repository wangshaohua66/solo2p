package com.heritage.controller;

import com.heritage.service.FileUploadService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/files/stream")
@Tag(name = "文件流式传输", description = "视频/音频流式传输，支持HTTP Range请求分片传输")
public class VideoStreamController {

    @Autowired
    private FileUploadService fileUploadService;

    private static final long CHUNK_SIZE = 1024 * 1024;

    @GetMapping("/{filename:.+}")
    @Operation(summary = "流式获取文件", description = "支持HTTP Range请求，实现视频/音频分片传输，浏览器可拖动进度条")
    public void streamFile(
            @Parameter(description = "文件名") @PathVariable String filename,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {

        File file = fileUploadService.getUploadedFile(filename);
        if (file == null || !file.exists()) {
            response.sendError(HttpStatus.NOT_FOUND.value(), "文件不存在");
            return;
        }

        long fileLength = file.length();
        String rangeHeader = request.getHeader(HttpHeaders.RANGE);
        String contentType = determineContentType(filename);
        response.setContentType(contentType);
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"");
        response.setHeader("X-Content-Type-Options", "nosniff");

        if (rangeHeader == null || rangeHeader.isEmpty()) {
            response.setHeader(HttpHeaders.CONTENT_LENGTH, String.valueOf(fileLength));
            response.setStatus(HttpStatus.OK.value());
            writeFileContent(file, 0, fileLength - 1, response);
            return;
        }

        String[] ranges = rangeHeader.replaceAll("bytes=", "").split("-");
        long start = Long.parseLong(ranges[0]);
        long end;

        if (ranges.length > 1 && !ranges[1].isEmpty()) {
            end = Long.parseLong(ranges[1]);
        } else {
            end = Math.min(start + CHUNK_SIZE - 1, fileLength - 1);
        }

        if (start >= fileLength || end >= fileLength) {
            response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength);
            response.sendError(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE.value());
            return;
        }

        long contentLength = end - start + 1;
        response.setHeader(HttpHeaders.CONTENT_LENGTH, String.valueOf(contentLength));
        response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileLength);
        response.setStatus(HttpStatus.PARTIAL_CONTENT.value());

        writeFileContent(file, start, end, response);
    }

    private void writeFileContent(File file, long start, long end, HttpServletResponse response) throws IOException {
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(start);
            byte[] buffer = new byte[8192];
            long remaining = end - start + 1;

            var outputStream = response.getOutputStream();
            while (remaining > 0) {
                int read = raf.read(buffer, 0, (int) Math.min(buffer.length, remaining));
                if (read == -1) break;
                outputStream.write(buffer, 0, read);
                remaining -= read;
            }
            outputStream.flush();
        }
    }

    private String determineContentType(String filename) {
        Path path = Paths.get(filename);
        String name = path.getFileName().toString();
        int dotIndex = name.lastIndexOf('.');
        if (dotIndex < 0) return MediaType.APPLICATION_OCTET_STREAM_VALUE;

        String extension = name.substring(dotIndex + 1).toLowerCase();
        return switch (extension) {
            case "mp4" -> "video/mp4";
            case "webm" -> "video/webm";
            case "avi" -> "video/x-msvideo";
            case "mov" -> "video/quicktime";
            case "wmv" -> "video/x-ms-wmv";
            case "flv" -> "video/x-flv";
            case "mkv" -> "video/x-matroska";
            case "mp3" -> "audio/mpeg";
            case "wav" -> "audio/wav";
            case "ogg" -> "audio/ogg";
            case "flac" -> "audio/flac";
            case "aac" -> "audio/aac";
            case "m4a" -> "audio/mp4";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "svg" -> "image/svg+xml";
            case "pdf" -> "application/pdf";
            default -> MediaType.APPLICATION_OCTET_STREAM_VALUE;
        };
    }
}
