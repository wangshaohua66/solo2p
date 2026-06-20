package com.sportsevent.controller;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.entity.CourtBooking;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Match;
import com.sportsevent.entity.Venue;
import com.sportsevent.exception.BusinessException;
import com.sportsevent.exception.ResourceNotFoundException;
import com.sportsevent.repository.CourtBookingRepository;
import com.sportsevent.repository.MatchRepository;
import com.sportsevent.repository.VenueRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
@Tag(name = "场馆管理", description = "场馆与场地预约接口，含可用时段查询与冲突锁定")
public class VenueController {

    private final VenueRepository venueRepository;
    private final CourtBookingRepository courtBookingRepository;
    private final MatchRepository matchRepository;

    @PostMapping
    @Operation(summary = "创建场馆")
    public ApiResponse<Venue> createVenue(@Valid @RequestBody Venue venue) {
        venue.setStatus(Venue.VenueStatus.ACTIVE);
        venue.setCreatedAt(LocalDateTime.now());
        venue.setUpdatedAt(LocalDateTime.now());
        Venue saved = venueRepository.save(venue);
        return ApiResponse.success("Venue created", saved);
    }

    @GetMapping
    @Operation(summary = "查询场馆列表")
    public ApiResponse<List<Venue>> listVenues(
            @Parameter(description = "支持的运动类型") @RequestParam(required = false) League.SportType sportType,
            @Parameter(description = "场馆状态") @RequestParam(required = false) Venue.VenueStatus status) {
        List<Venue> venues;
        if (status != null) {
            venues = venueRepository.findByStatus(status);
        } else if (sportType != null) {
            venues = venueRepository.findActiveBySport(sportType);
        } else {
            venues = venueRepository.findAll();
        }
        return ApiResponse.success(venues);
    }

    @GetMapping("/{id}")
    @Operation(summary = "查询场馆详情")
    public ApiResponse<Venue> getVenue(@PathVariable String id) {
        Venue venue = venueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venue", id));
        return ApiResponse.success(venue);
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新场馆信息")
    public ApiResponse<Venue> updateVenue(@PathVariable String id, @Valid @RequestBody Venue venue) {
        Venue existing = venueRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venue", id));
        venue.setId(existing.getId());
        venue.setCreatedAt(existing.getCreatedAt());
        venue.setUpdatedAt(LocalDateTime.now());
        Venue saved = venueRepository.save(venue);
        return ApiResponse.success("Venue updated", saved);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除场馆")
    public ApiResponse<Void> deleteVenue(@PathVariable String id) {
        if (!venueRepository.existsById(id)) {
            throw new ResourceNotFoundException("Venue", id);
        }
        venueRepository.deleteById(id);
        return ApiResponse.success("Venue deleted", null);
    }

    @GetMapping("/{venueId}/availability")
    @Operation(summary = "查询场地可用时段", description = "按30分钟粒度查询指定日期的可用场地时段")
    public ApiResponse<List<AvailableSlot>> checkAvailability(
            @PathVariable String venueId,
            @Parameter(description = "查询开始时间") @RequestParam String startTime,
            @Parameter(description = "查询结束时间") @RequestParam String endTime) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new ResourceNotFoundException("Venue", venueId));

        LocalDateTime start = LocalDateTime.parse(startTime);
        LocalDateTime end = LocalDateTime.parse(endTime);

        List<CourtBooking> existingBookings = courtBookingRepository.findByVenueAndTimeRange(venueId, start, end);
        List<Match> existingMatches = matchRepository.findConflictingMatches(venueId, 0, start, end);

        List<AvailableSlot> availableSlots = new ArrayList<>();
        int totalCourts = venue.getTotalCourts() != null ? venue.getTotalCourts() : 1;

        for (int court = 1; court <= totalCourts; court++) {
            LocalDateTime slotStart = start;
            while (slotStart.isBefore(end)) {
                LocalDateTime slotEnd = slotStart.plusMinutes(30);

                int finalCourt = court;
                boolean hasBookingConflict = existingBookings.stream()
                        .anyMatch(b -> b.getCourtNumber() != null && b.getCourtNumber() == finalCourt
                                && b.getStartTime().isBefore(slotEnd) && b.getEndTime().isAfter(slotStart));

                boolean hasMatchConflict = existingMatches.stream()
                        .anyMatch(m -> m.getCourtNumber() != null && m.getCourtNumber() == finalCourt
                                && m.getStartTime().isBefore(slotEnd) && m.getEndTime().isAfter(slotStart));

                if (!hasBookingConflict && !hasMatchConflict) {
                    AvailableSlot slot = new AvailableSlot();
                    slot.setCourtNumber(court);
                    slot.setStartTime(slotStart.toString());
                    slot.setEndTime(slotEnd.toString());
                    slot.setAvailable(true);
                    availableSlots.add(slot);
                }

                slotStart = slotEnd;
            }
        }

        return ApiResponse.success("Found " + availableSlots.size() + " available slots", availableSlots);
    }

    @PostMapping("/bookings")
    @Operation(summary = "创建场地预约")
    public ApiResponse<CourtBooking> createBooking(@Valid @RequestBody CourtBooking booking) {
        if (booking.getStartTime() == null || booking.getEndTime() == null) {
            throw new BusinessException("Start time and end time are required");
        }
        if (booking.getEndTime().isBefore(booking.getStartTime())) {
            throw new BusinessException("End time must be after start time");
        }

        List<CourtBooking> conflicts = courtBookingRepository.findConflictingBookings(
                booking.getVenueId(), booking.getCourtNumber(),
                booking.getStartTime(), booking.getEndTime());
        if (!conflicts.isEmpty()) {
            throw new BusinessException("Time slot already booked: " + conflicts.size() + " conflicting bookings");
        }

        booking.setStatus(CourtBooking.BookingStatus.CONFIRMED);
        booking.setCreatedAt(LocalDateTime.now());
        booking.setUpdatedAt(LocalDateTime.now());

        CourtBooking saved = courtBookingRepository.save(booking);
        return ApiResponse.success("Booking created", saved);
    }

    @GetMapping("/bookings")
    @Operation(summary = "查询场地预约列表")
    public ApiResponse<List<CourtBooking>> listBookings(
            @Parameter(description = "场馆ID") @RequestParam(required = false) String venueId,
            @Parameter(description = "关联比赛ID") @RequestParam(required = false) String matchId,
            @Parameter(description = "关联联赛ID") @RequestParam(required = false) String leagueId) {
        List<CourtBooking> bookings;
        if (matchId != null) {
            bookings = courtBookingRepository.findByRelatedMatchId(matchId);
        } else if (leagueId != null) {
            bookings = courtBookingRepository.findByRelatedLeagueId(leagueId);
        } else if (venueId != null) {
            bookings = courtBookingRepository.findByVenueId(venueId);
        } else {
            bookings = courtBookingRepository.findAll();
        }
        return ApiResponse.success(bookings);
    }

    @GetMapping("/bookings/{id}")
    @Operation(summary = "查询预约详情")
    public ApiResponse<CourtBooking> getBooking(@PathVariable String id) {
        CourtBooking booking = courtBookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CourtBooking", id));
        return ApiResponse.success(booking);
    }

    @DeleteMapping("/bookings/{id}")
    @Operation(summary = "取消场地预约")
    public ApiResponse<CourtBooking> cancelBooking(@PathVariable String id) {
        CourtBooking booking = courtBookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CourtBooking", id));

        booking.setStatus(CourtBooking.BookingStatus.CANCELLED);
        booking.setUpdatedAt(LocalDateTime.now());
        CourtBooking saved = courtBookingRepository.save(booking);

        return ApiResponse.success("Booking cancelled", saved);
    }

    @lombok.Data
    public static class AvailableSlot {
        private Integer courtNumber;
        private String startTime;
        private String endTime;
        private boolean available;
    }
}
