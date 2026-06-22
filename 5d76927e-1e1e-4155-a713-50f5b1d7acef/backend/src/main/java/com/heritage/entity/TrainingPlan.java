package com.heritage.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "training_plans")
public class TrainingPlan {

    @Id
    private String id;

    private String year;

    private String inheritorId;

    private String heritageId;

    private String planName;

    private String objectives;

    private int targetApprenticeCount;

    private double targetTeachingHours;

    private List<TrainingRecord> trainingRecords = new ArrayList<>();

    private double completedHours;

    private int completedAssessments;

    private String progressStatus;

    private LocalDate startDate;

    private LocalDate endDate;

    private String reportUrl;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
