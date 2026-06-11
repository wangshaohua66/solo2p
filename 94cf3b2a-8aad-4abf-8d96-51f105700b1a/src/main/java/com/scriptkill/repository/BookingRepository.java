package com.scriptkill.repository;

import com.scriptkill.entity.Booking;
import com.scriptkill.entity.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findBySessionId(Long sessionId);

    List<Booking> findByPlayerId(Long playerId);

    List<Booking> findBySessionIdAndStatus(Long sessionId, BookingStatus status);

    List<Booking> findByPlayerIdAndStatus(Long playerId, BookingStatus status);

    Optional<Booking> findBySessionIdAndPlayerId(Long sessionId, Long playerId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.session.id = :sessionId AND b.status = 'CONFIRMED'")
    long countConfirmedBookingsBySessionId(Long sessionId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.player.id = :playerId AND b.status = 'NO_SHOW'")
    long countNoShowsByPlayerId(Long playerId);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.player.id = :playerId")
    long countTotalBookingsByPlayerId(Long playerId);

    @Query("SELECT b FROM Booking b WHERE b.player.id = :playerId AND b.session.startTime BETWEEN :start AND :end")
    List<Booking> findPlayerBookingsBetween(Long playerId, LocalDateTime start, LocalDateTime end);

    boolean existsBySessionIdAndPlayerId(Long sessionId, Long playerId);
}
