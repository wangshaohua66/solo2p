package com.tvstation.media.service;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ReviewItem;
import com.tvstation.media.entity.ReviewRecord;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

public interface ReviewService {

    PageResult<ReviewItem> getReviews(ReviewItem.ReviewStatus status, ReviewItem.ReviewType type,
                                      Integer currentLevel, Pageable pageable);

    ReviewItem getReviewById(Long id);

    ReviewRecord submitReview(Long itemId, Integer level, String status, String comment,
                              String version, Long userId, String userName);

    List<ReviewRecord> getReviewHistory(Long itemId);

    String compareVersions(Long itemId, String version1, String version2);

    List<ReviewItem> getPendingReviewsByUser(Long userId);

    void remindReviewer(Long itemId, Long reviewerId, Long operatorId);

    ReviewItem createReview(ReviewItem reviewItem, Long userId, String userName);

    Map<String, Object> getReviewStatistics();

    void processTimeoutReviews();
}
