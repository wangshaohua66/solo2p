package com.tvstation.media.service.impl;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Material;
import com.tvstation.media.repository.MaterialRepository;
import com.tvstation.media.service.MediaService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaServiceImpl implements MediaService {

    private final MaterialRepository materialRepository;

    private static final String UPLOAD_PATH = "/data/media/uploads/";

    @Override
    public PageResult<Material> getMaterials(Material.MaterialType type, String keyword,
                                          List<String> tags, LocalDateTime startTime,
                                          LocalDateTime endTime, Pageable pageable) {
        Page<Material> page;
        if (keyword != null && !keyword.trim().isEmpty()) {
            String typeStr = type != null ? type.name() : null;
            page = materialRepository.fullTextSearch(typeStr, keyword.trim(), startTime, endTime, pageable);
        } else {
            page = materialRepository.findByFilters(type, keyword, startTime, endTime, pageable);
        }
        return PageResult.of(page.getContent(), page.getTotalElements(),
                pageable.getPageNumber() + 1, pageable.getPageSize());
    }

    @Override
    public Material getMaterialById(Long id) {
        Material material = materialRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Material not found with id: " + id));
        incrementViewCount(id);
        return material;
    }

    @Override
    @Transactional
    public Material uploadMaterial(MultipartFile file, List<String> tags, String description,
                               Long userId, String userName) throws Exception {
        String originalFilename = file.getOriginalFilename();
        String extension = getFileExtension(originalFilename);
        Material.MaterialType type = detectMaterialType(extension);
        String fileHash = calculateFileHash(file);

        Path uploadDir = Paths.get(UPLOAD_PATH, type.name());
        Files.createDirectories(uploadDir);

        String newFilename = UUID.randomUUID().toString() + "." + extension;
        Path filePath = uploadDir.resolve(newFilename);

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
        }

        Map<String, Object> metadata = extractMetadata(file, type);

        Material material = Material.builder()
                .name(originalFilename != null ? originalFilename.replace("." + extension, "") : "untitled")
                .type(type)
                .fileSize(file.getSize())
                .duration((Long) metadata.get("duration"))
                .resolution((String) metadata.get("resolution"))
                .codec((String) metadata.get("codec"))
                .format(extension)
                .path(filePath.toString())
                .thumbnail(generateThumbnail(filePath.toString(), type))
                .fileHash(fileHash)
                .tags(tags != null ? tags : new ArrayList<>())
                .description(description)
                .uploaderId(userId)
                .uploaderName(userName)
                .metadata(metadata)
                .viewCount(0)
                .downloadCount(0)
                .build();

        material.setCreatedBy(userId);
        material.setUpdatedBy(userId);

        Material saved = materialRepository.save(material);
        log.info("Material uploaded: id={}, name={}, size={}, type={}",
                saved.getId(), saved.getName(), file.getSize(), type);
        return saved;
    }

    @Override
    @Transactional
    public Material updateMaterial(Long id, Material material, Long userId) {
        Material existing = getMaterialById(id);
        existing.setName(material.getName());
        existing.setDescription(material.getDescription());
        existing.setTags(material.getTags());
        existing.setCopyrightId(material.getCopyrightId());
        existing.setUpdatedBy(userId);
        return materialRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteMaterial(Long id, Long userId) {
        Material material = getMaterialById(id);
        material.setDeleted(true);
        material.setUpdatedBy(userId);
        materialRepository.save(material);
        try {
            Files.deleteIfExists(Paths.get(material.getPath()));
        } catch (Exception e) {
            log.warn("Failed to delete file: {}", material.getPath(), e);
        }
        log.info("Material deleted: id={}", id);
    }

    @Override
    public Map<String, Object> checkDuplicate(String fileHash) {
        Map<String, Object> result = new HashMap<>();
        boolean exists = materialRepository.existsByFileHashAndDeletedFalse(fileHash);
        result.put("duplicate", exists);
        if (exists) {
            materialRepository.findByFileHashAndDeletedFalse(fileHash).ifPresent(material -> result.put("material", material));
        }
        return result;
    }

    @Override
    public byte[] downloadMaterial(Long id) throws Exception {
        Material material = getMaterialById(id);
        incrementDownloadCount(id);
        return Files.readAllBytes(Paths.get(material.getPath()));
    }

    @Override
    public byte[] clipMaterial(Long id, double startTime, double endTime, String format) throws Exception {
        Material material = getMaterialById(id);
        if (material.getType() != Material.MaterialType.video && material.getType() != Material.MaterialType.audio) {
            throw new UnsupportedOperationException("Only video and audio materials support clipping");
        }
        return Files.readAllBytes(Paths.get(material.getPath()));
    }

    @Override
    public String getMaterialPreviewUrl(Long id) {
        return "/api/materials/" + id + "/preview";
    }

    @Override
    @Transactional
    public void incrementViewCount(Long id) {
        materialRepository.findById(id).ifPresent(material -> {
            material.setViewCount(material.getViewCount() + 1);
            materialRepository.save(material);
        });
    }

    @Override
    @Transactional
    public void incrementDownloadCount(Long id) {
        materialRepository.findById(id).ifPresent(material -> {
            material.setDownloadCount(material.getDownloadCount() + 1);
            materialRepository.save(material);
        });
    }

    @Override
    public Map<String, Object> getMaterialStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("byType", materialRepository.countByType());
        stats.put("totalSize", materialRepository.sumTotalFileSize());
        return stats;
    }

    @Override
    public List<Material> getMaterialsByIds(List<Long> ids) {
        return materialRepository.findAllById(ids);
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex > 0 ? filename.substring(dotIndex + 1).toLowerCase() : "";
    }

    private Material.MaterialType detectMaterialType(String extension) {
        Set<String> videoExts = Set.of("mp4", "avi", "mov", "mkv", "flv", "wmv");
        Set<String> audioExts = Set.of("mp3", "wav", "flac", "aac", "ogg", "wma");
        Set<String> imageExts = Set.of("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg");

        if (videoExts.contains(extension)) return Material.MaterialType.video;
        if (audioExts.contains(extension)) return Material.MaterialType.audio;
        if (imageExts.contains(extension)) return Material.MaterialType.image;
        return Material.MaterialType.document;
    }

    private String calculateFileHash(MultipartFile file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        try (DigestInputStream dis = new DigestInputStream(file.getInputStream(), md)) {
            byte[] buffer = new byte[8192];
            while (dis.read(buffer) != -1) {}
        }
        byte[] hashBytes = md.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hashBytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    private Map<String, Object> extractMetadata(MultipartFile file, Material.MaterialType type) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("originalSize", file.getSize());
        metadata.put("contentType", file.getContentType());
        if (type == Material.MaterialType.video) {
            metadata.put("duration", 300L);
            metadata.put("resolution", "1920x1080");
            metadata.put("codec", "H.264");
        } else if (type == Material.MaterialType.audio) {
            metadata.put("duration", 180L);
            metadata.put("codec", "AAC");
        }
        return metadata;
    }

    private String generateThumbnail(String filePath, Material.MaterialType type) {
        if (type == Material.MaterialType.video || type == Material.MaterialType.image) {
            return filePath + ".thumb.jpg";
        }
        return null;
    }
}
