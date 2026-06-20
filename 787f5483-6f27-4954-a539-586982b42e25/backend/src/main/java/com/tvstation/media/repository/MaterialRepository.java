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

    @Query("SELECT m FROM Material m JOIN m.tags t WHERE m.deleted = false AND t IN :tags")
    Page<Material> findByTags(@Param("tags") List<String> tags, Pageable pageable);

    @Query("SELECT m.type, COUNT(m) FROM Material m WHERE m.deleted = false GROUP BY m.type")
    List<Object[]> countByType();

    @Query("SELECT SUM(m.fileSize) FROM Material m WHERE m.deleted = false")
    Long sumTotalFileSize();

    @Query("SELECT COUNT(m) FROM Material m WHERE m.deleted = false AND m.createdAt >= :startDate AND m.createdAt <= :endDate")
    Long countByDateRange(@Param("startDate") LocalDateTime startDate,
                          @Param("endDate") LocalDateTime endDate);

    boolean existsByFileHashAndDeletedFalse(String fileHash);
}
