package com.heritage.repository;

import com.heritage.entity.Booking;
import com.heritage.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface BookingRepository extends MongoRepository<Booking, String> {

    Page<Booking> findByInstitutionId(String institutionId, Pageable pageable);

    Page<Booking> findByInheritorId(String inheritorId, Pageable pageable);

    Page<Booking> findByStatus(BookingStatus status, Pageable pageable);

    @Query("{ 'inheritorId': ?0, 'status': { $in: ['PENDING', 'APPROVED'] }, " +
            "$or: [ { 'startTime': { $gte: ?1, $lte: ?2 } }, { 'endTime': { $gte: ?1, $lte: ?2 } }, " +
            "{ 'startTime': { $lte: ?1 }, 'endTime': { $gte: ?2 } } ] }")
    List<Booking> findConflictingBookings(String inheritorId, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{ 'inheritorId': ?0, 'startTime': { $gte: ?1, $lte: ?2 }, 'status': { $in: ['PENDING', 'APPROVED'] } }")
    List<Booking> findByInheritorIdAndDateRange(String inheritorId, LocalDateTime start, LocalDateTime end);

    @Query("{ 'createdAt': { $gte: ?1, $lte: ?2 } }")
    List<Booking> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByStatus(BookingStatus status);
}
