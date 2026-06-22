package com.heritage.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "inheritors")
public class Inheritor {

    @Id
    private String id;

    @Indexed
    private String name;

    private String gender;

    private LocalDate birthDate;

    private Integer age;

    private String ethnicity;

    private String region;

    private String avatar;

    private String bio;

    private String skillCharacteristics;

    private String representativeWorks;

    private String masterId;

    private List<String> studentIds = new ArrayList<>();

    private List<String> heritageIds = new ArrayList<>();

    private List<ApprenticeRecord> apprenticeRecords = new ArrayList<>();

    private List<TrainingSchedule> availableSchedules = new ArrayList<>();

    private double totalTeachingHours;

    private int apprenticeCount;

    private String phone;

    private String email;

    private String userId;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
