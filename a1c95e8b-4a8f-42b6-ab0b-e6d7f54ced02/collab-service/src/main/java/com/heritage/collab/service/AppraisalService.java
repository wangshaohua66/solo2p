package com.heritage.collab.service;

import com.heritage.collab.entity.Annotation;
import com.heritage.collab.entity.AppraisalTask;
import com.heritage.collab.entity.Comment;
import com.heritage.collab.enums.AppraisalStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

public interface AppraisalService {
    AppraisalTask createTask(AppraisalTask task);
    AppraisalTask updateTask(String id, AppraisalTask task);
    void deleteTask(String id);
    AppraisalTask getTaskById(String id);
    List<AppraisalTask> getTasksByArtifact(String artifactId);
    Page<AppraisalTask> getTasksByCreator(String creatorId, Pageable pageable);
    Page<AppraisalTask> getTasksByExpert(String expertId, Pageable pageable);
    Page<AppraisalTask> getTasksByStatus(AppraisalStatus status, Pageable pageable);
    AppraisalTask inviteExperts(String taskId, List<String> expertIds);
    AppraisalTask submitOpinion(String taskId, String expertId, String opinion);
    AppraisalTask completeTask(String taskId, String conclusion);
    AppraisalTask cancelTask(String taskId);

    Annotation addAnnotation(Annotation annotation);
    Annotation updateAnnotation(String id, Annotation annotation);
    void deleteAnnotation(String id);
    List<Annotation> getAnnotationsByAppraisal(String appraisalId);
    List<Annotation> getAnnotationsByImage(String imageId);

    Comment addComment(Comment comment);
    void deleteComment(String id);
    List<Comment> getCommentsByAppraisal(String appraisalId);

    Map<String, Object> generateReport(String taskId);
    Map<String, Object> getStats();
}
