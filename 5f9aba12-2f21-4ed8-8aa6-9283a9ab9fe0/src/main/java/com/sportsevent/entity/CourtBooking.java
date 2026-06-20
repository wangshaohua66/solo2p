package com.sportsevent.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "court_bookings")
@CompoundIndex(name = "idx_booking_venue_court_time", def = "{'venueId': 1, 'courtNumber': 1, 'startTime': 1, 'endTime': 1}")
public class CourtBooking {

    @Id
    private String id;

    private String venueId;

    private Integer courtNumber;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private BookingType bookingType;

    private String relatedMatchId;

    private String relatedLeagueId;

    private String bookedBy;

    private BookingStatus status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum BookingType {
        MATCH, TRAINING, MAINTENANCE, OTHER
    }

    public enum BookingStatus {
        CONFIRMED, CANCELLED, TEMPORARY
    }
}
