package com.design.collaboration.service;

import com.design.collaboration.dto.ReviewCommentRequest;
import com.design.collaboration.entity.ReviewComment;
import com.design.collaboration.entity.ReviewRecord;
import com.design.collaboration.entity.User;
import com.design.collaboration.enums.ReviewLevel;
import com.design.collaboration.enums.ReviewStatus;
import com.design.collaboration.mapper.ReviewMapper;
import com.design.collaboration.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ReviewService {

    @Autowired
    private ReviewMapper reviewMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private ProjectService projectService;

    public ReviewRecord findById(Long id) {
        ReviewRecord record = reviewMapper.findById(id);
        if (record != null) {
            record.setComments(reviewMapper.findCommentsByReviewRecordId(id));
        }
        return record;
    }

    public List<ReviewRecord> findByConditions(Long projectId, Long taskId,
                                                ReviewStatus status, Long reviewerId) {
        List<ReviewRecord> records = reviewMapper.findByConditions(projectId, taskId, status, reviewerId);
        return records;
    }

    public ReviewRecord create(Long taskId, Long projectId, Long versionId, ReviewLevel level, Long reviewerId) {
        ReviewRecord record = new ReviewRecord();
        record.setTaskId(taskId);
        record.setProjectId(projectId);
        record.setVersionId(versionId);
        record.setLevel(level);
        record.setReviewerId(reviewerId);
        record.setStatus(ReviewStatus.IN_PROGRESS);
        record.setSubmittedAt(LocalDateTime.now());
        reviewMapper.insert(record);

        User reviewer = reviewerId != null ? userMapper.findById(reviewerId) : null;
        projectService.addLog(projectId, "REVIEW",
                "发起" + level + "级校审" + (reviewer != null ? "，校审人：" + reviewer.getName() : ""),
                reviewerId, reviewer != null ? reviewer.getName() : null);

        return findById(record.getId());
    }

    public ReviewComment addComment(ReviewCommentRequest request, Long operatorId) {
        ReviewComment comment = new ReviewComment();
        comment.setReviewRecordId(request.getReviewRecordId());
        comment.setContent(request.getContent());
        comment.setLocation(request.getLocation());
        comment.setCreatedBy(operatorId);
        comment.setResolved(false);
        comment.setCreatedAt(LocalDateTime.now());
        reviewMapper.insertComment(comment);

        ReviewRecord record = reviewMapper.findById(request.getReviewRecordId());
        if (record != null && record.getStatus() == ReviewStatus.PENDING) {
            reviewMapper.updateStatus(request.getReviewRecordId(), ReviewStatus.IN_PROGRESS, null);
        }

        User user = operatorId != null ? userMapper.findById(operatorId) : null;
        ReviewRecord r = reviewMapper.findById(request.getReviewRecordId());
        if (r != null) {
            projectService.addLog(r.getProjectId(), "REVIEW",
                    "添加校审意见：" + request.getContent(),
                    operatorId, user != null ? user.getName() : null);
        }

        ReviewComment result = new ReviewComment();
        result.setId(comment.getId());
        result.setReviewRecordId(comment.getReviewRecordId());
        result.setContent(comment.getContent());
        result.setLocation(comment.getLocation());
        result.setResolved(comment.getResolved());
        result.setCreatedBy(comment.getCreatedBy());
        result.setCreatedAt(comment.getCreatedAt());
        if (user != null) result.setCreatedByName(user.getName());
        return result;
    }

    public ReviewComment replyComment(Long commentId, String reply, boolean resolved, Long operatorId) {
        reviewMapper.updateComment(commentId, reply, resolved);

        List<ReviewComment> comments = reviewMapper.findCommentsByReviewRecordId(
                reviewMapper.findCommentsByReviewRecordId(0L).isEmpty() ? 0L :
                        getReviewRecordIdByCommentId(commentId)
        );

        ReviewComment updated = comments.stream().filter(c -> c.getId().equals(commentId)).findFirst().orElse(null);

        User user = operatorId != null ? userMapper.findById(operatorId) : null;
        if (updated != null) {
            ReviewRecord r = reviewMapper.findById(updated.getReviewRecordId());
            if (r != null) {
                projectService.addLog(r.getProjectId(), "REVIEW",
                        (resolved ? "解决校审意见：" : "回复校审意见：") + reply,
                        operatorId, user != null ? user.getName() : null);
            }
        }

        return updated;
    }

    private Long getReviewRecordIdByCommentId(Long commentId) {
        for (ReviewRecord r : reviewMapper.findByConditions(null, null, null, null)) {
            for (ReviewComment c : reviewMapper.findCommentsByReviewRecordId(r.getId())) {
                if (c.getId().equals(commentId)) return r.getId();
            }
        }
        return 0L;
    }

    public ReviewRecord completeReview(Long id, boolean passed) {
        ReviewRecord record = reviewMapper.findById(id);
        if (record == null) {
            throw new RuntimeException("校审记录不存在");
        }
        ReviewStatus newStatus = passed ? ReviewStatus.PASSED : ReviewStatus.REJECTED;
        reviewMapper.updateStatus(id, newStatus, LocalDateTime.now());

        User reviewer = record.getReviewerId() != null ? userMapper.findById(record.getReviewerId()) : null;
        projectService.addLog(record.getProjectId(), "REVIEW",
                "校审" + (passed ? "通过" : "驳回") + "，校审人：" + (reviewer != null ? reviewer.getName() : ""),
                record.getReviewerId(), reviewer != null ? reviewer.getName() : null);

        return findById(id);
    }
}
