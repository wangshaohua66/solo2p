package com.tvstation.media.service.impl;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ReviewItem;
import com.tvstation.media.entity.ReviewRecord;
import com.tvstation.media.entity.Topic;
import com.tvstation.media.repository.ReviewRecordRepository;
import com.tvstation.media.repository.ReviewRepository;
import com.tvstation.media.repository.TopicRepository;
import com.tvstation.media.service.ReviewService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ReviewRecordRepository reviewRecordRepository;
    private final TopicRepository topicRepository;

    @Override
    public PageResult<ReviewItem> getReviews(ReviewItem.ReviewStatus status,
                                           ReviewItem.ReviewType type,
                                           Integer currentLevel,
                                           Pageable pageable) {
        Specification<ReviewItem> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (currentLevel != null) {
                predicates.add(cb.equal(root.get("currentLevel"), currentLevel));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ReviewItem> page = reviewRepository.findAll(spec, pageable);
        return PageResult.of(page.getContent(), page.getTotalElements(),
                pageable.getPageNumber() + 1, pageable.getPageSize());
    }

    @Override
    public ReviewItem getReviewById(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Review not found with id: " + id));
    }

    @Override
    @Transactional
    public ReviewRecord submitReview(Long itemId, Integer level, String status, String comment,
                                   String version, Long userId, String userName) {
        ReviewItem item = getReviewById(itemId);
        ReviewRecord.ReviewStatus reviewStatus = ReviewRecord.ReviewStatus.valueOf(status);

        ReviewRecord record = ReviewRecord.builder()
                .reviewItemId(itemId)
                .level(level)
                .status(reviewStatus)
                .comment(comment)
                .version(version)
                .reviewerId(userId)
                .reviewerName(userName)
                .reviewedAt(LocalDateTime.now())
                .build();
        record.setCreatedBy(userId);
        record.setUpdatedBy(userId);

        ReviewRecord savedRecord = reviewRecordRepository.save(record);

        if (reviewStatus == ReviewRecord.ReviewStatus.approved) {
            if (level < 3) {
                item.setCurrentLevel(level + 1);
                if (level + 1 == 2) {
                    item.setStatus(ReviewItem.ReviewStatus.in_review);
                }
            } else {
                item.setStatus(ReviewItem.ReviewStatus.approved);
                item.setCurrentLevel(4);
                if (item.getType() == ReviewItem.ReviewType.topic && item.getTopicId() != null) {
                    topicRepository.findById(item.getTopicId()).ifPresent(topic -> {
                        topic.setStatus(Topic.TopicStatus.published);
                        topicRepository.save(topic);
                    });
                }
            }
        } else if (reviewStatus == ReviewRecord.ReviewStatus.rejected) {
            item.setStatus(ReviewItem.ReviewStatus.rejected);
            if (item.getType() == ReviewItem.ReviewType.topic && item.getTopicId() != null) {
                topicRepository.findById(item.getTopicId()).ifPresent(topic -> {
                    topic.setStatus(Topic.TopicStatus.review_rejected);
                    topicRepository.save(topic);
                });
            }
        } else if (reviewStatus == ReviewRecord.ReviewStatus.returned) {
            item.setStatus(ReviewItem.ReviewStatus.modifying);
            item.setCurrentLevel(1);
        }

        item.setUpdatedBy(userId);
        reviewRepository.save(item);

        log.info("Review submitted: itemId={}, level={}, status={}, reviewer={}",
                itemId, level, status, userName);
        return savedRecord;
    }

    @Override
    public List<ReviewRecord> getReviewHistory(Long itemId) {
        return reviewRecordRepository.findByReviewItemIdOrderByReviewedAtDesc(itemId);
    }

    @Override
    public String compareVersions(Long itemId, String version1, String version2) {
        return "版本对比结果：版本 " + version1 + " 与版本 " + version2 + " 的差异...";
    }

    @Override
    public List<ReviewItem> getPendingReviewsByUser(Long userId) {
        return reviewRepository.findByCurrentReviewerAndDeletedFalse(userId);
    }

    @Override
    @Transactional
    public void remindReviewer(Long itemId, Long reviewerId, Long operatorId) {
        ReviewItem item = getReviewById(itemId);
        ReviewRecord record = ReviewRecord.builder()
                .reviewItemId(itemId)
                .level(item.getCurrentLevel())
                .status(ReviewRecord.ReviewStatus.pending)
                .comment("系统提醒：请尽快审核")
                .reviewerId(reviewerId)
                .reviewerName("系统")
                .reviewedAt(LocalDateTime.now())
                .build();
        record.setCreatedBy(operatorId);
        record.setUpdatedBy(operatorId);
        reviewRecordRepository.save(record);
        log.info("Reminder sent for review item: {}", itemId);
    }

    @Override
    @Transactional
    public ReviewItem createReview(ReviewItem reviewItem, Long userId, String userName) {
        reviewItem.setStatus(ReviewItem.ReviewStatus.pending);
        reviewItem.setCurrentLevel(1);
        reviewItem.setSubmittedAt(LocalDateTime.now());
        reviewItem.setSubmitterId(userId);
        reviewItem.setSubmitterName(userName);
        reviewItem.setCreatedBy(userId);
        reviewItem.setUpdatedBy(userId);

        ReviewItem saved = reviewRepository.save(reviewItem);
        log.info("Review created: id={}, type={}", saved.getId(), saved.getType());

        if (saved.getType() == ReviewItem.ReviewType.topic && saved.getTopicId() != null) {
            topicRepository.findById(saved.getTopicId()).ifPresent(topic -> {
                topic.setStatus(Topic.TopicStatus.in_review);
                topicRepository.save(topic);
            });
        }
        return saved;
    }

    @Override
    public Map<String, Object> getReviewStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("byStatus", reviewRepository.countByStatus());
        stats.put("byType", reviewRepository.countByType());
        stats.put("totalCount", reviewRepository.countByDeletedFalse());
        stats.put("pendingCount", reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.pending));
        stats.put("inReviewCount", reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.in_review));
        stats.put("approvedCount", reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.approved));
        stats.put("rejectedCount", reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.rejected));
        Double avgReviewTime = reviewRecordRepository.calculateAvgTotalReviewTime();
        stats.put("avgTotalReviewTimeHours", avgReviewTime != null ? avgReviewTime : 0);
        return stats;
    }

    @Override
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void processTimeoutReviews() {
        List<ReviewItem> timeoutItems = reviewRepository.findTimeoutReviews(24);
        for (ReviewItem item : timeoutItems) {
            log.warn("Review timeout: id={}, currentLevel={}", item.getId(), item.getCurrentLevel());
        }
    }
}
