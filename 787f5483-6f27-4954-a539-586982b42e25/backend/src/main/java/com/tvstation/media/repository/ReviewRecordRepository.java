package com.tvstation.media.repository;

import com.tvstation.media.entity.ReviewRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRecordRepository extends JpaRepository<ReviewRecord, Long>, JpaSpecificationExecutor<ReviewRecord> {

    List<ReviewRecord> findByReviewItemIdOrderByReviewedAtDesc(Long reviewItemId);

    List<ReviewRecord> findByReviewerIdAndDeletedFalse(Long reviewerId);

    @Query("SELECT r FROM ReviewRecord r WHERE r.deleted = false AND " +
           "r.reviewItemId = :itemId AND r.level = :level " +
           "ORDER BY r.reviewedAt DESC")
    List<ReviewRecord> findByItemIdAndLevel(
            @Param("itemId") Long itemId,
            @Param("level") Integer level);

    @Query("SELECT r FROM ReviewRecord r WHERE r.deleted = false AND " +
           "r.reviewItemId = :itemId AND r.status = :status")
    List<ReviewRecord> findByItemIdAndStatus(
            @Param("itemId") Long itemId,
            @Param("status") ReviewRecord.ReviewStatus status);

    boolean existsByReviewItemIdAndLevelAndStatus(Long itemId, Integer level, ReviewRecord.ReviewStatus status);

    @Query("SELECT AVG(TIMESTAMPDIFF(HOUR, r.reviewedAt, r2.reviewedAt)) " +
           "FROM ReviewRecord r JOIN ReviewRecord r2 ON r.reviewItemId = r2.reviewItemId " +
           "WHERE r.deleted = false AND r2.deleted = false AND " +
           "r.level = 1 AND r2.level = 3 AND r.status = 'approved' AND r2.status = 'approved'")
    Double calculateAvgTotalReviewTime();
}
