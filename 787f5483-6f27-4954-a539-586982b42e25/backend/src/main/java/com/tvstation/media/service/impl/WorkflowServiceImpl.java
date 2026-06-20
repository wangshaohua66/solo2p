package com.tvstation.media.service.impl;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Task;
import com.tvstation.media.entity.Topic;
import com.tvstation.media.entity.TopicLog;
import com.tvstation.media.repository.TaskRepository;
import com.tvstation.media.repository.TopicLogRepository;
import com.tvstation.media.repository.TopicRepository;
import com.tvstation.media.service.WorkflowService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowServiceImpl implements WorkflowService {

    private final TopicRepository topicRepository;
    private final TopicLogRepository topicLogRepository;
    private final TaskRepository taskRepository;

    @Override
    public PageResult<Topic> getTopics(Topic.TopicStatus status, Topic.ProgramType programType,
                                       Topic.Channel channel, String keyword, Pageable pageable) {
        Page<Topic> page = topicRepository.findByFilters(status, programType, channel, keyword, pageable);
        return PageResult.of(page.getContent(), page.getTotalElements(),
                pageable.getPageNumber() + 1, pageable.getPageSize());
    }

    @Override
    public Topic getTopicById(Long id) {
        return topicRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Topic not found with id: " + id));
    }

    @Override
    @Transactional
    public Topic createTopic(Topic topic, Long userId, String userName) {
        topic.setCreatorId(userId);
        topic.setCreatorName(userName);
        topic.setStatus(Topic.TopicStatus.draft);
        topic.setCreatedBy(userId);
        topic.setUpdatedBy(userId);

        Topic saved = topicRepository.save(topic);

        TopicLog log = TopicLog.builder()
                .topic(saved)
                .action("创建选题")
                .operatorId(userId)
                .operatorName(userName)
                .remark("创建选题：" + topic.getTitle())
                .toStatus(Topic.TopicStatus.draft.name())
                .build();
        topicLogRepository.save(log);

        generateTasksForTopic(saved);

        log.info("Topic created: id={}, title={}, creator={}", saved.getId(), saved.getTitle(), userName);
        return saved;
    }

    @Override
    @Transactional
    public Topic updateTopic(Long id, Topic topic, Long userId) {
        Topic existing = getTopicById(id);
        String oldStatus = existing.getStatus().name();

        existing.setTitle(topic.getTitle());
        existing.setDescription(topic.getDescription());
        existing.setDuration(topic.getDuration());
        existing.setExpectedAirDate(topic.getExpectedAirDate());
        existing.setProgramType(topic.getProgramType());
        existing.setChannel(topic.getChannel());
        existing.setInterviewee(topic.getInterviewee());
        existing.setLocation(topic.getLocation());
        existing.setUpdatedBy(userId);

        Topic saved = topicRepository.save(existing);

        TopicLog updateLog = TopicLog.builder()
                .topic(saved)
                .action("更新选题")
                .operatorId(userId)
                .operatorName("用户")
                .remark("更新选题信息")
                .fromStatus(oldStatus)
                .toStatus(saved.getStatus().name())
                .build();
        topicLogRepository.save(updateLog);

        log.info("Topic updated: id={}", id);
        return saved;
    }

    @Override
    @Transactional
    public void deleteTopic(Long id, Long userId) {
        Topic topic = getTopicById(id);
        topic.setDeleted(true);
        topic.setUpdatedBy(userId);
        topicRepository.save(topic);

        TopicLog log = TopicLog.builder()
                .topic(topic)
                .action("删除选题")
                .operatorId(userId)
                .operatorName("用户")
                .remark("删除选题：" + topic.getTitle())
                .build();
        topicLogRepository.save(log);

        log.info("Topic deleted: id={}", id);
    }

    @Override
    @Transactional
    public Topic submitTopic(Long id, Long userId, String userName) {
        Topic topic = getTopicById(id);
        String oldStatus = topic.getStatus().name();

        if (topic.getStatus() != Topic.TopicStatus.draft) {
            throw new IllegalStateException("Only draft topics can be submitted");
        }

        topic.setStatus(Topic.TopicStatus.submitted);
        topic.setUpdatedBy(userId);
        Topic saved = topicRepository.save(topic);

        TopicLog logEntry = TopicLog.builder()
                .topic(saved)
                .action("提交审核")
                .operatorId(userId)
                .operatorName(userName)
                .remark("提交选题进行审核")
                .fromStatus(oldStatus)
                .toStatus(Topic.TopicStatus.submitted.name())
                .build();
        topicLogRepository.save(logEntry);

        log.info("Topic submitted: id={}, user={}", id, userName);
        return saved;
    }

    @Override
    @Transactional
    public Topic reviewTopic(Long id, String status, String remark, Long userId, String userName) {
        Topic topic = getTopicById(id);
        String oldStatus = topic.getStatus().name();

        Topic.TopicStatus newStatus = "approved".equals(status)
                ? Topic.TopicStatus.approved
                : Topic.TopicStatus.rejected;

        topic.setStatus(newStatus);
        topic.setUpdatedBy(userId);
        Topic saved = topicRepository.save(topic);

        String action = "approved".equals(status) ? "审核通过" : "审核退回";

        TopicLog logEntry = TopicLog.builder()
                .topic(saved)
                .action(action)
                .operatorId(userId)
                .operatorName(userName)
                .remark(remark)
                .fromStatus(oldStatus)
                .toStatus(newStatus.name())
                .build();
        topicLogRepository.save(logEntry);

        if ("approved".equals(status)) {
            topic.setStatus(Topic.TopicStatus.in_production);
            topicRepository.save(topic);
        }

        log.info("Topic reviewed: id={}, status={}, reviewer={}", id, status, userName);
        return saved;
    }

    @Override
    public List<TopicLog> getTopicLogs(Long topicId) {
        return topicLogRepository.findByTopicIdOrderByCreatedAtDesc(topicId);
    }

    @Override
    public List<Task> getTopicTasks(Long topicId) {
        return taskRepository.findByTopicIdOrderByCreatedAtAsc(topicId);
    }

    @Override
    @Transactional
    public Task updateTaskStatus(Long taskId, Task.TaskStatus status, Long userId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with id: " + taskId));
        task.setStatus(status);
        task.setUpdatedBy(userId);
        return taskRepository.save(task);
    }

    @Override
    @Transactional
    public Task assignTask(Long taskId, Long assigneeId, String assigneeName, Long userId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new EntityNotFoundException("Task not found with id: " + taskId));
        task.setAssigneeId(assigneeId);
        task.setAssigneeName(assigneeName);
        task.setStatus(Task.TaskStatus.in_progress);
        task.setUpdatedBy(userId);
        return taskRepository.save(task);
    }

    @Override
    public List<Topic> getTopicsByDateRange(Topic.TopicStatus status, LocalDate startDate, LocalDate endDate) {
        return topicRepository.findByStatusAndExpectedAirDateBetweenAndDeletedFalse(status, startDate, endDate);
    }

    @Override
    public Map<String, Object> getTopicStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("byProgramType", topicRepository.countByProgramType());
        stats.put("byChannel", topicRepository.countByChannel());
        return stats;
    }

    @Override
    public void generateTasksForTopic(Topic topic) {
        List<Task> tasks = new ArrayList<>();
        LocalDate dueDate = topic.getExpectedAirDate().minusDays(7);

        tasks.add(Task.builder()
                .topic(topic)
                .name("素材采集")
                .type(Task.TaskType.collection)
                .status(Task.TaskStatus.pending)
                .dueDate(dueDate.minusDays(5))
                .description("采集与选题相关的视频、音频、图片素材")
                .build());

        tasks.add(Task.builder()
                .topic(topic)
                .name("脚本撰写")
                .type(Task.TaskType.script)
                .status(Task.TaskStatus.pending)
                .dueDate(dueDate.minusDays(3))
                .description("根据选题内容撰写节目脚本")
                .build());

        tasks.add(Task.builder()
                .topic(topic)
                .name("后期编辑")
                .type(Task.TaskType.editing)
                .status(Task.TaskStatus.pending)
                .dueDate(dueDate)
                .description("根据脚本进行视频剪辑、特效处理、音频混合")
                .build());

        tasks.add(Task.builder()
                .topic(topic)
                .name("内容审核")
                .type(Task.TaskType.review)
                .status(Task.TaskStatus.pending)
                .dueDate(dueDate.plusDays(1))
                .description("对成片进行内容审核，确保符合播出要求")
                .build());

        for (int i = 0; i < tasks.size(); i++) {
            tasks.get(i).setCreatedBy(topic.getCreatorId());
            tasks.get(i).setUpdatedBy(topic.getCreatorId());
        }

        taskRepository.saveAll(tasks);
        log.info("Tasks generated for topic: id={}, taskCount={}", topic.getId(), tasks.size());
    }
}
