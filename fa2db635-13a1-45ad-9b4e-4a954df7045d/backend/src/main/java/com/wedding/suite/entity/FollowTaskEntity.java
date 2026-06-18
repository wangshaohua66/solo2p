package com.wedding.suite.entity;

import com.wedding.suite.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "follow_task")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FollowTaskEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "wedding_id", nullable = false)
    private Long weddingId;
    @Column(nullable = false, length = 64)
    private String title;
    @Column(name = "days_before", nullable = false)
    private Integer daysBefore;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TaskStatus status;
    @Column(length = 32)
    private String owner;
    @Column(name = "due_date")
    private LocalDate dueDate;
}
