package com.tvstation.media.repository;

import com.tvstation.media.entity.Material;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MaterialRepository extends JpaRepository<Material, Long>, JpaSpecificationExecutor<Material> {

    Page<Material> findByTypeAndDeletedFalse(Material.MaterialType type, Pageable pageable);

    Page<Material> findByUploaderIdAndDeletedFalse(Long uploaderId, Pageable pageable);

    Optional<Material> findByFileHashAndDeletedFalse(String fileHash);

    @Query("SELECT m FROM Material m WHERE m.deleted = false AND " +
           "(:type IS NULL OR m.type = :type) AND " +
           "(:keyword IS NULL OR LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(m.description) LIKE LOWER(CONCAT('%', :keyword, '%'))) AND " +
           "(:startTime IS NULL OR m.createdAt >= :startTime) AND " +
           "(:endTime IS NULL OR m.createdAt <= :endTime)")
    Page<Material> findByFilters(
            @Param("type") Material.MaterialType type,
            @Param("keyword") String keyword,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    @Query(value = "SELECT m.* FROM materials m WHERE m.deleted = false AND " +
           "(:type IS NULL OR m.type = :type) AND " +
           "(:keyword IS NULL OR m.search_vector @@ plainto_tsquery('simple', :keyword)) AND " +
           "(:startTime IS NULL OR m.created_at >= :startTime) AND " +
           "(:endTime IS NULL OR m.created_at <= :endTime) " +
           "ORDER BY ts_rank(m.search_vector, plainto_tsquery('simple', :keyword)) DESC, m.created_at DESC",
           countQuery = "SELECT count(m.id) FROM materials m WHERE m.deleted = false AND " +
           "(:type IS NULL OR m.type = :type) AND " +
           "(:keyword IS NULL OR m.search_vector @@ plainto_tsquery('simple', :keyword)) AND " +
           "(:startTime IS NULL OR m.created_at >= :startTime) AND " +
           "(:endTime IS NULL OR m.created_at <= :endTime)",
           nativeQuery = true)
    Page<Material> fullTextSearch(
            @Param("type") String type,
            @Param("keyword") String keyword,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);

    @Query(value = "SELECT m.* FROM materials m JOIN material_tags mt ON mt.material_id = m.id " +
           "WHERE m.deleted = false AND mt.tag IN :tags " +
           "GROUP BY m.id ORDER BY count(m.id) DESC, m.created_at DESC",
           countQuery = "SELECT count(DISTINCT m.id) FROM materials m JOIN material_tags mt ON mt.material_id = m.id " +
           "WHERE m.deleted = false AND mt.tag IN :tags",
           nativeQuery = true)
    Page<Material> findByTagsNative(@Param("tags") List<String> tags, Pageable pageable);

    @Query("SELECT m FROM Material m JOIN m.tags t WHERE m.deleted = false AND t IN :tags")
    Page<Material> findByTags(@Param("tags") List<String> tags, Pageable pageable);

    @Query("SELECT m.type, COUNT(m) FROM Material m WHERE m.deleted = false GROUP BY m.type")
    List<Object[]> countByType();

    @Query("SELECT SUM(m.fileSize) FROM Material m WHERE m.deleted = false")
    Long sumTotalFileSize();

    @Query("SELECT COUNT(m) FROM Material m WHERE m.deleted = false AND m.createdAt >= :startDate AND m.createdAt <= :endDate")
    Long countByDateRange(@Param("startDate") LocalDateTime startDate,
                          @Param("endDate") LocalDateTime endDate);

    @Query("SELECT m.uploaderId, m.uploaderName, COUNT(m) " +
           "FROM Material m WHERE m.deleted = false " +
           "AND (:uploaderId IS NULL OR m.uploaderId = :uploaderId) " +
           "AND m.createdAt >= :startDate AND m.createdAt <= :endDate " +
           "GROUP BY m.uploaderId, m.uploaderName")
    List<Object[]> aggregateByUploader(@Param("startDate") LocalDateTime startDate,
                                       @Param("endDate") LocalDateTime endDate,
                                       @Param("uploaderId") Long uploaderId);

    boolean existsByFileHashAndDeletedFalse(String fileHash);
}
