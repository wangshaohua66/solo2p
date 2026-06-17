package com.heritage.collab.service.impl;

import com.heritage.collab.entity.Annotation;
import com.heritage.collab.entity.AppraisalTask;
import com.heritage.collab.entity.Comment;
import com.heritage.collab.enums.AppraisalStatus;
import com.heritage.collab.repository.AnnotationRepository;
import com.heritage.collab.repository.AppraisalTaskRepository;
import com.heritage.collab.repository.CommentRepository;
import com.heritage.collab.service.AppraisalService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class AppraisalServiceImpl implements AppraisalService {

    private final AppraisalTaskRepository taskRepository;
    private final AnnotationRepository annotationRepository;
    private final CommentRepository commentRepository;

    @Override
    public AppraisalTask createTask(AppraisalTask task) {
        if (task.getStatus() == null) task.setStatus(AppraisalStatus.DRAFT);
        task.setCreateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public AppraisalTask updateTask(String id, AppraisalTask task) {
        AppraisalTask existing = getTaskById(id);
        if (task.getTitle() != null) existing.setTitle(task.getTitle());
        if (task.getDescription() != null) existing.setDescription(task.getDescription());
        if (task.getDeadline() != null) existing.setDeadline(task.getDeadline());
        if (task.getStatus() != null) existing.setStatus(task.getStatus());
        existing.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(existing);
    }

    @Override
    public void deleteTask(String id) {
        annotationRepository.deleteByAppraisalId(id);
        commentRepository.deleteByAppraisalId(id);
        taskRepository.deleteById(id);
    }

    @Override
    public AppraisalTask getTaskById(String id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("鉴定任务不存在"));
    }

    @Override
    public List<AppraisalTask> getTasksByArtifact(String artifactId) {
        return taskRepository.findByArtifactId(artifactId);
    }

    @Override
    public Page<AppraisalTask> getTasksByCreator(String creatorId, Pageable pageable) {
        return taskRepository.findByCreatorId(creatorId, pageable);
    }

    @Override
    public Page<AppraisalTask> getTasksByExpert(String expertId, Pageable pageable) {
        return taskRepository.findByExpertIdsContaining(expertId, pageable);
    }

    @Override
    public Page<AppraisalTask> getTasksByStatus(AppraisalStatus status, Pageable pageable) {
        return taskRepository.findByStatus(status, pageable);
    }

    @Override
    public AppraisalTask inviteExperts(String taskId, List<String> expertIds) {
        AppraisalTask task = getTaskById(taskId);
        task.getExpertIds().addAll(expertIds);
        if (task.getStatus() == AppraisalStatus.DRAFT) task.setStatus(AppraisalStatus.INVITING);
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public AppraisalTask submitOpinion(String taskId, String expertId, String opinion) {
        AppraisalTask task = getTaskById(taskId);
        if (!task.getExpertIds().contains(expertId)) {
            throw new RuntimeException("您不在受邀专家列表中");
        }
        task.getExpertOpinions().put(expertId, opinion);
        if (task.getStatus() != AppraisalStatus.IN_PROGRESS && task.getStatus() != AppraisalStatus.COMPLETED) {
            task.setStatus(AppraisalStatus.IN_PROGRESS);
        }
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public AppraisalTask completeTask(String taskId, String conclusion) {
        AppraisalTask task = getTaskById(taskId);
        task.setConclusion(conclusion);
        task.setStatus(AppraisalStatus.COMPLETED);
        task.setCompletedTime(LocalDateTime.now());
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public AppraisalTask cancelTask(String taskId) {
        AppraisalTask task = getTaskById(taskId);
        task.setStatus(AppraisalStatus.CANCELLED);
        task.setUpdateTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    @Override
    public Annotation addAnnotation(Annotation annotation) {
        annotation.setCreateTime(LocalDateTime.now());
        return annotationRepository.save(annotation);
    }

    @Override
    public Annotation updateAnnotation(String id, Annotation annotation) {
        Annotation existing = annotationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("标注不存在"));
        if (annotation.getX() != null) existing.setX(annotation.getX());
        if (annotation.getY() != null) existing.setY(annotation.getY());
        if (annotation.getWidth() != null) existing.setWidth(annotation.getWidth());
        if (annotation.getHeight() != null) existing.setHeight(annotation.getHeight());
        if (annotation.getContent() != null) existing.setContent(annotation.getContent());
        existing.setUpdateTime(LocalDateTime.now());
        return annotationRepository.save(existing);
    }

    @Override
    public void deleteAnnotation(String id) {
        annotationRepository.deleteById(id);
    }

    @Override
    public List<Annotation> getAnnotationsByAppraisal(String appraisalId) {
        return annotationRepository.findByAppraisalId(appraisalId);
    }

    @Override
    public List<Annotation> getAnnotationsByImage(String imageId) {
        return annotationRepository.findByImageId(imageId);
    }

    @Override
    public Comment addComment(Comment comment) {
        comment.setCreateTime(LocalDateTime.now());
        return commentRepository.save(comment);
    }

    @Override
    public void deleteComment(String id) {
        commentRepository.deleteById(id);
    }

    @Override
    public List<Comment> getCommentsByAppraisal(String appraisalId) {
        return commentRepository.findByAppraisalIdOrderByCreateTimeDesc(appraisalId);
    }

    @Override
    public Map<String, Object> generateReport(String taskId) {
        AppraisalTask task = getTaskById(taskId);
        List<Annotation> annotations = getAnnotationsByAppraisal(taskId);
        List<Comment> comments = getCommentsByAppraisal(taskId);

        Map<String, Object> report = new HashMap<>();
        report.put("task", task);
        report.put("annotations", annotations);
        report.put("comments", comments);
        report.put("annotationCount", annotations.size());
        report.put("commentCount", comments.size());
        report.put("expertCount", task.getExpertIds().size());
        report.put("submittedOpinionCount", task.getExpertOpinions().size());
        report.put("generatedTime", LocalDateTime.now());
        return report;
    }

    @Override
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalTasks", taskRepository.count());
        Map<String, Long> byStatus = new HashMap<>();
        for (AppraisalStatus status : AppraisalStatus.values()) {
            byStatus.put(status.getName(), taskRepository.countByStatus(status));
        }
        stats.put("byStatus", byStatus);
        stats.put("totalAnnotations", annotationRepository.count());
        stats.put("totalComments", commentRepository.count());
        return stats;
    }
}
