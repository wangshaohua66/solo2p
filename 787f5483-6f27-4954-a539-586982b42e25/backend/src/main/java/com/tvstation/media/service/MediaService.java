package com.tvstation.media.service;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Material;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public interface MediaService {

    PageResult<Material> getMaterials(Material.MaterialType type, String keyword,
                                      List<String> tags, LocalDateTime startTime,
                                      LocalDateTime endTime, Pageable pageable);

    Material getMaterialById(Long id);

    Material uploadMaterial(MultipartFile file, List<String> tags, String description,
                            Long userId, String userName) throws Exception;

    Material updateMaterial(Long id, Material material, Long userId);

    void deleteMaterial(Long id, Long userId);

    Map<String, Object> checkDuplicate(String fileHash);

    byte[] downloadMaterial(Long id) throws Exception;

    byte[] clipMaterial(Long id, double startTime, double endTime, String format) throws Exception;

    String getMaterialPreviewUrl(Long id);

    void incrementViewCount(Long id);

    void incrementDownloadCount(Long id);

    Map<String, Object> getMaterialStatistics();

    List<Material> getMaterialsByIds(List<Long> ids);
}
