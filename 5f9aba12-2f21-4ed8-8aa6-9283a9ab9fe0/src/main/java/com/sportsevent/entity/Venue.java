package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "venues")
public class Venue {

    @Id
    private String id;

    @Indexed
    private String name;

    private String address;

    private String contactPhone;

    private Integer totalCourts;

    private List<League.SportType> supportedSports;

    private List<TimeSlot> availableTimeSlots;

    private VenueStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum VenueStatus {
        ACTIVE, MAINTENANCE, CLOSED
    }

    @Data
    public static class TimeSlot {
        private String dayOfWeek;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }
}
