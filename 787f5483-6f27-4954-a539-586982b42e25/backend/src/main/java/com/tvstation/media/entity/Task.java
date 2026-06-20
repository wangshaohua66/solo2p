package com.tvstation.media.entity;

import com.tvstation.media.common.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "tasks", indexes = {
    @Index(name = "idx_task_topic", columnList = "topicId"),
    @Index(name = "idx_task_assignee", columnList = "assigneeId"),
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_task_type", columnList = "type")
})
public class Task extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topicId", nullable = false)
    private Topic topic;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskType type;

    private Long assigneeId;

    @Column(length = 50)
    private String assigneeName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    private LocalDate dueDate;

    @Column(columnDefinition = "TEXT")
    private String description;

    public enum TaskType {
        collection, script, editing, review
    }

    public enum TaskStatus {
        pending, in_progress, completed, rejected
    }
}
