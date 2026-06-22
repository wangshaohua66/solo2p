package com.heritage.entity;

import com.heritage.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "bookings")
@CompoundIndex(name = "inheritor_time_idx", def = "{'inheritorId': 1, 'startTime': 1, 'endTime': 1}")
public class Booking {

    @Id
    private String id;

    private String heritageId;

    private String inheritorId;

    private String institutionId;

    private String institutionName;

    private String contactPerson;

    private String contactPhone;

    private String contactEmail;

    private int participantCount;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private String location;

    private String content;

    private String specialRequirements;

    private BookingStatus status;

    private String approvalRemark;

    private String approvedBy;

    private LocalDateTime approvedAt;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
