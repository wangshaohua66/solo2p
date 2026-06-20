package com.tvstation.media.repository;

import com.tvstation.media.entity.ReviewItem;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<ReviewItem, Long>, JpaSpecificationExecutor<ReviewItem> {

    Page<ReviewItem> findByStatusAndDeletedFalse(ReviewItem.ReviewStatus status, Pageable pageable);

    Page<ReviewItem> findByTypeAndDeletedFalse(ReviewItem.ReviewType type, Pageable pageable);

    Page<ReviewItem> findByCurrentLevelAndDeletedFalse(Integer currentLevel, Pageable pageable);

    Page<ReviewItem> findBySubmitterIdAndDeletedFalse(Long submitterId, Pageable pageable);

    @Query("SELECT r FROM ReviewItem r WHERE r.deleted = false AND " +
           "(:status IS NULL OR r.status = :status) AND " +
           "(:type IS NULL OR r.type = :type) AND " +
           "(:currentLevel IS NULL OR r.currentLevel = :currentLevel)")
    Page<ReviewItem> findByFilters(
            @Param("status") ReviewItem.ReviewStatus status,
            @Param("type") ReviewItem.ReviewType type,
            @Param("currentLevel") Integer currentLevel,
            Pageable pageable);

    @Query("SELECT r FROM ReviewItem r WHERE r.deleted = false AND " +
           "r.status IN ('pending', 'reviewing') AND " +
           "r.submittedAt < :timeout")
    List<ReviewItem> findTimeoutReviews(@Param("timeout") LocalDateTime timeout);

    @Query("SELECT r.status, COUNT(r) FROM ReviewItem r WHERE r.deleted = false GROUP BY r.status")
    List<Object[]> countByStatus();

    @Query("SELECT r.type, COUNT(r) FROM ReviewItem r WHERE r.deleted = false GROUP BY r.type")
    List<Object[]> countByType();

    long countByDeletedFalse();

    long countByStatusAndDeletedFalse(ReviewItem.ReviewStatus status);

    List<ReviewItem> findByCurrentReviewerIdAndDeletedFalse(Long currentReviewerId);

    @Query("SELECT AVG(TIMESTAMPDIFF(HOUR, r.submittedAt, r.updatedAt)) FROM ReviewItem r " +
           "WHERE r.deleted = false AND r.status = 'completed'")
    Double calculateAvgReviewTime();

    @Query("SELECT r FROM ReviewItem r WHERE r.deleted = false AND " +
           "r.status IN ('pending', 'reviewing') AND " +
           "r.currentLevel = :level")
    List<ReviewItem> findPendingByLevel(@Param("level") Integer level);

    List<ReviewItem> findByTopicIdAndDeletedFalse(Long topicId);

    @Query("SELECT r.submitterId, r.submitterName, COUNT(r) " +
           "FROM ReviewItem r WHERE r.deleted = false " +
           "AND (:submitterId IS NULL OR r.submitterId = :submitterId) " +
           "AND r.submittedAt >= :startDate AND r.submittedAt <= :endDate " +
           "GROUP BY r.submitterId, r.submitterName")
    List<Object[]> aggregateBySubmitter(@Param("startDate") LocalDateTime startDate,
                                        @Param("endDate") LocalDateTime endDate,
                                        @Param("submitterId") Long submitterId);
}
