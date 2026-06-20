package com.sportsevent.repository;

import com.sportsevent.entity.CourtBooking;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CourtBookingRepository extends MongoRepository<CourtBooking, String> {

    List<CourtBooking> findByVenueId(String venueId);

    List<CourtBooking> findByRelatedMatchId(String relatedMatchId);

    List<CourtBooking> findByRelatedLeagueId(String relatedLeagueId);

    @Query("{'venueId': ?0, 'courtNumber': ?1, 'startTime': {$lt: ?3}, 'endTime': {$gt: ?2}, 'status': {$ne: 'CANCELLED'}}")
    List<CourtBooking> findConflictingBookings(String venueId, Integer courtNumber, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{'venueId': ?0, 'startTime': {$gte: ?1, $lte: ?2}, 'status': {$ne: 'CANCELLED'}}")
    List<CourtBooking> findByVenueAndTimeRange(String venueId, LocalDateTime startTime, LocalDateTime endTime);
}
