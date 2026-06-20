package com.tvstation.media.service;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.Task;
import com.tvstation.media.entity.Topic;
import com.tvstation.media.entity.TopicLog;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface WorkflowService {

    PageResult<Topic> getTopics(Topic.TopicStatus status, Topic.ProgramType programType,
                                Topic.Channel channel, String keyword, Pageable pageable);

    Topic getTopicById(Long id);

    Topic createTopic(Topic topic, Long userId, String userName);

    Topic updateTopic(Long id, Topic topic, Long userId);

    void deleteTopic(Long id, Long userId);

    Topic submitTopic(Long id, Long userId, String userName);

    Topic reviewTopic(Long id, String status, String remark, Long userId, String userName);

    List<TopicLog> getTopicLogs(Long topicId);

    List<Task> getTopicTasks(Long topicId);

    Task updateTaskStatus(Long taskId, Task.TaskStatus status, Long userId);

    Task assignTask(Long taskId, Long assigneeId, String assigneeName, Long userId);

    List<Topic> getTopicsByDateRange(Topic.TopicStatus status, LocalDate startDate, LocalDate endDate);

    Map<String, Object> getTopicStatistics();

    void generateTasksForTopic(Topic topic);
}
