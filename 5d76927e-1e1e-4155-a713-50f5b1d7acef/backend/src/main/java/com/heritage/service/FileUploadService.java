package com.heritage.service;

import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Directory;
import com.drew.metadata.Metadata;
import com.drew.metadata.Tag;
import com.heritage.entity.MediaFile;
import com.heritage.enums.MediaType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class FileUploadService {

    @Value("${heritage.upload.dir:./uploads}")
    private String uploadDir;

    @Value("${heritage.upload.base-url:/api/files/stream}")
    private String baseUrl;

    public MediaFile uploadFile(MultipartFile file, String description, String username) {
        ensureUploadDir();

        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename);
        String storedFilename = UUID.randomUUID() + "." + extension;

        Path filePath = Paths.get(uploadDir, storedFilename);
        try {
            Files.copy(file.getInputStream(), filePath);
        } catch (IOException e) {
            throw new RuntimeException("文件保存失败: " + e.getMessage());
        }

        MediaType mediaType = determineMediaType(file.getContentType(), extension);
        Map<String, Object> metadata = extractMetadata(filePath.toFile(), mediaType, file.getContentType());

        return MediaFile.builder()
                .id(UUID.randomUUID().toString())
                .fileName(originalFilename)
                .type(mediaType)
                .fileUrl(baseUrl + "/" + storedFilename)
                .fileSize(file.getSize())
                .mimeType(file.getContentType())
                .description(description)
                .metadata(metadata)
                .uploadedAt(LocalDateTime.now())
                .uploadedBy(username)
                .build();
    }

    private void ensureUploadDir() {
        Path path = Paths.get(uploadDir);
        if (!Files.exists(path)) {
            try {
                Files.createDirectories(path);
            } catch (IOException e) {
                throw new RuntimeException("无法创建上传目录: " + e.getMessage());
            }
        }
    }

    private MediaType determineMediaType(String contentType, String extension) {
        if (contentType != null) {
            if (contentType.startsWith("image/")) return MediaType.IMAGE;
            if (contentType.startsWith("video/")) return MediaType.VIDEO;
            if (contentType.startsWith("audio/")) return MediaType.AUDIO;
        }
        return switch (extension.toLowerCase()) {
            case "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "svg" -> MediaType.IMAGE;
            case "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm" -> MediaType.VIDEO;
            case "mp3", "wav", "ogg", "flac", "aac", "wma", "m4a" -> MediaType.AUDIO;
            default -> MediaType.DOCUMENT;
        };
    }

    private Map<String, Object> extractMetadata(File file, MediaType mediaType, String contentType) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("extractedAt", LocalDateTime.now().toString());

        if (mediaType == MediaType.IMAGE) {
            extractImageMetadata(file, metadata);
        } else if (mediaType == MediaType.VIDEO) {
            extractVideoMetadata(file, metadata);
        } else if (mediaType == MediaType.AUDIO) {
            extractAudioMetadata(file, metadata);
        }

        metadata.put("fileSizeHuman", formatFileSize(file.length()));
        return metadata;
    }

    private void extractImageMetadata(File file, Map<String, Object> metadata) {
        try {
            BufferedImage image = ImageIO.read(file);
            if (image != null) {
                metadata.put("width", image.getWidth());
                metadata.put("height", image.getHeight());
                metadata.put("colorDepth", image.getColorModel().getPixelSize());
                metadata.put("hasAlpha", image.getColorModel().hasAlpha());
            }
        } catch (IOException e) {
            metadata.put("imageReadError", e.getMessage());
        }

        try {
            Metadata exifMetadata = ImageMetadataReader.readMetadata(file);
            for (Directory directory : exifMetadata.getDirectories()) {
                for (Tag tag : directory.getTags()) {
                    String tagName = tag.getTagName().replaceAll("[^a-zA-Z0-9]", "_");
                    if (isRelevantExifTag(tagName)) {
                        metadata.put("exif_" + tagName, tag.getDescription());
                    }
                }
            }
        } catch (Exception e) {
            metadata.put("exifReadError", "EXIF extraction failed: " + e.getMessage());
        }
    }

    private boolean isRelevantExifTag(String tagName) {
        return tagName.contains("Date") || tagName.contains("Model") ||
                tagName.contains("Make") || tagName.contains("Lens") ||
                tagName.contains("Focal") || tagName.contains("ISO") ||
                tagName.contains("Aperture") || tagName.contains("Shutter") ||
                tagName.contains("Exposure") || tagName.contains("GPS") ||
                tagName.contains("Orientation") || tagName.contains("Resolution");
    }

    private void extractVideoMetadata(File file, Map<String, Object> metadata) {
        try {
            ProcessBuilder pb = new ProcessBuilder("ffprobe",
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    "-show_streams",
                    file.getAbsolutePath());
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            process.waitFor();

            if (!output.isEmpty() && output.contains("{")) {
                int jsonStart = output.indexOf("{");
                String jsonStr = output.substring(jsonStart);

                if (jsonStr.contains("\"duration\"")) {
                    String duration = extractJsonField(jsonStr, "duration");
                    if (duration != null) {
                        try {
                            double seconds = Double.parseDouble(duration);
                            metadata.put("durationSeconds", seconds);
                            metadata.put("durationFormatted", formatDuration(seconds));
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (jsonStr.contains("\"width\"")) {
                    String width = extractJsonField(jsonStr, "width");
                    if (width != null) metadata.put("width", Integer.parseInt(width));
                }
                if (jsonStr.contains("\"height\"")) {
                    String height = extractJsonField(jsonStr, "height");
                    if (height != null) metadata.put("height", Integer.parseInt(height));
                }
                if (jsonStr.contains("\"codec_name\"")) {
                    metadata.put("codec", extractJsonField(jsonStr, "codec_name"));
                }
                if (jsonStr.contains("\"bit_rate\"")) {
                    metadata.put("bitRate", extractJsonField(jsonStr, "bit_rate"));
                }
            }
        } catch (Exception e) {
            metadata.put("ffprobeError", "ffprobe not available: " + e.getMessage());
            metadata.put("durationExtraction", "fallback");
        }
    }

    private void extractAudioMetadata(File file, Map<String, Object> metadata) {
        try {
            ProcessBuilder pb = new ProcessBuilder("ffprobe",
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    file.getAbsolutePath());
            pb.redirectErrorStream(true);
            Process process = pb.start();
            String output = new String(process.getInputStream().readAllBytes());
            process.waitFor();

            if (!output.isEmpty() && output.contains("{")) {
                int jsonStart = output.indexOf("{");
                String jsonStr = output.substring(jsonStart);

                String duration = extractJsonField(jsonStr, "duration");
                if (duration != null) {
                    try {
                        double seconds = Double.parseDouble(duration);
                        metadata.put("durationSeconds", seconds);
                        metadata.put("durationFormatted", formatDuration(seconds));
                    } catch (NumberFormatException ignored) {}
                }
                if (jsonStr.contains("\"bit_rate\"")) {
                    metadata.put("bitRate", extractJsonField(jsonStr, "bit_rate"));
                }
                if (jsonStr.contains("\"codec_name\"")) {
                    metadata.put("codec", extractJsonField(jsonStr, "codec_name"));
                }
            }
        } catch (Exception e) {
            metadata.put("ffprobeError", "ffprobe not available: " + e.getMessage());
        }
    }

    private String extractJsonField(String json, String fieldName) {
        String pattern = "\"" + fieldName + "\":\"";
        int start = json.indexOf(pattern);
        if (start < 0) {
            String patternNoQuote = "\"" + fieldName + "\":";
            int startNQ = json.indexOf(patternNoQuote);
            if (startNQ >= 0) {
                int valueStart = startNQ + patternNoQuote.length();
                int valueEnd = json.indexOf(",", valueStart);
                if (valueEnd < 0) valueEnd = json.indexOf("}", valueStart);
                if (valueEnd > valueStart) {
                    return json.substring(valueStart, valueEnd).trim().replace("\"", "");
                }
            }
            return null;
        }
        start += pattern.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : null;
    }

    private String formatDuration(double seconds) {
        int hrs = (int) seconds / 3600;
        int mins = ((int) seconds % 3600) / 60;
        int secs = (int) seconds % 60;
        if (hrs > 0) return String.format("%d:%02d:%02d", hrs, mins, secs);
        return String.format("%d:%02d", mins, secs);
    }

    private String formatFileSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.1f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1f MB", bytes / (1024.0 * 1024));
        return String.format("%.1f GB", bytes / (1024.0 * 1024 * 1024));
    }

    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "bin";
        return filename.substring(filename.lastIndexOf(".") + 1);
    }

    public File getUploadedFile(String filename) {
        File file = new File(Paths.get(uploadDir, filename).toString());
        return file.exists() ? file : null;
    }
}
