package com.scriptkill.service;

import com.scriptkill.dto.booking.BookingCreateRequest;
import com.scriptkill.dto.booking.BookingResponse;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.*;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final DepositRepository depositRepository;
    private final ScriptCharacterRepository characterRepository;
    private final RiskService riskService;

    public BookingService(BookingRepository bookingRepository,
                          SessionRepository sessionRepository,
                          UserRepository userRepository,
                          DepositRepository depositRepository,
                          ScriptCharacterRepository characterRepository,
                          RiskService riskService) {
        this.bookingRepository = bookingRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.depositRepository = depositRepository;
        this.characterRepository = characterRepository;
        this.riskService = riskService;
    }

    @Transactional
    public BookingResponse createBooking(BookingCreateRequest request) {
        GameSession session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new BusinessException("会话不存在"));

        if (session.getStatus() == SessionStatus.COMPLETED ||
                session.getStatus() == SessionStatus.CANCELLED) {
            throw new BusinessException("该场次已结束或已取消");
        }

        User player = userRepository.findById(request.getPlayerId())
                .orElseThrow(() -> new BusinessException("玩家不存在"));

        if (player.getRole() != Role.PLAYER) {
            throw new BusinessException("该用户不是玩家");
        }

        if (bookingRepository.existsBySessionIdAndPlayerId(
                request.getSessionId(), request.getPlayerId())) {
            throw new BusinessException("已预约该场次");
        }

        long confirmedCount = bookingRepository.countConfirmedBookingsBySessionId(
                request.getSessionId());
        if (confirmedCount >= session.getMaxPlayers()) {
            throw new BusinessException("该场次已满");
        }

        Booking booking = new Booking();
        booking.setSession(session);
        booking.setPlayer(player);
        booking.setStatus(BookingStatus.PENDING);
        booking.setBookingTime(LocalDateTime.now());
        booking.setNotes(request.getNotes());
        booking.setCharacterPreference1(request.getCharacterPreference1());
        booking.setCharacterPreference2(request.getCharacterPreference2());
        booking.setCharacterPreference3(request.getCharacterPreference3());

        int requiredDeposit = riskService.calculateRequiredDeposit(
                request.getPlayerId(), session.getDepositAmount());
        requiredDeposit = Math.max(requiredDeposit, session.getDepositAmount());

        booking.setDepositPaid(requiredDeposit);

        Deposit deposit = new Deposit();
        deposit.setBooking(booking);
        deposit.setPlayer(player);
        deposit.setSession(session);
        deposit.setAmount(requiredDeposit);
        deposit.setStatus(DepositStatus.HELD);
        deposit.setPaymentMethod(request.getPaymentMethod());
        depositRepository.save(deposit);

        booking.setStatus(BookingStatus.CONFIRMED);
        booking = bookingRepository.save(booking);

        session.setCurrentPlayersCount((int) (confirmedCount + 1));
        sessionRepository.save(session);

        return convertToResponse(booking);
    }

    @Transactional
    public BookingResponse cancelBooking(Long bookingId, String reason, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        if (booking.getStatus() == BookingStatus.CANCELLED ||
                booking.getStatus() == BookingStatus.COMPLETED ||
                booking.getStatus() == BookingStatus.NO_SHOW) {
            throw new BusinessException("当前状态不可取消");
        }

        GameSession session = booking.getSession();

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelTime(LocalDateTime.now());
        booking.setCancelReason(reason);
        bookingRepository.save(booking);

        if (session.getStartTime() != null) {
            riskService.recordLateCancel(booking.getPlayer().getId(),
                    session.getStartTime(), LocalDateTime.now());
        }

        Deposit deposit = depositRepository.findByBookingId(bookingId).orElse(null);
        if (deposit != null && deposit.getStatus() == DepositStatus.HELD) {
            boolean isLateCancel = session.getStartTime() != null &&
                    java.time.Duration.between(LocalDateTime.now(),
                            session.getStartTime()).toHours() < 6;

            if (isLateCancel) {
                deposit.setStatus(DepositStatus.FORFEITED);
                deposit.setForfeitReason("距开场不足6小时取消，定金不退");
            } else {
                deposit.setStatus(DepositStatus.REFUNDED);
                deposit.setRefundAmount(deposit.getAmount());
                deposit.setRefundTime(LocalDateTime.now());
                booking.setIsDepositRefunded(true);
            }
            depositRepository.save(deposit);
        }

        long confirmedCount = bookingRepository.countConfirmedBookingsBySessionId(
                session.getId());
        session.setCurrentPlayersCount((int) confirmedCount);
        sessionRepository.save(session);

        return convertToResponse(booking);
    }

    @Transactional
    public BookingResponse checkIn(Long bookingId, Long dmUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException("只有已确认的预约可以签到");
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setCheckInTime(LocalDateTime.now());
        bookingRepository.save(booking);

        riskService.recordSuccessfulAttendance(booking.getPlayer().getId());

        return convertToResponse(booking);
    }

    @Transactional
    public void markNoShow(Long bookingId, Long dmUserId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BusinessException("预约不存在"));

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new BusinessException("只有已确认的预约可以标记为爽约");
        }

        booking.setStatus(BookingStatus.NO_SHOW);
        bookingRepository.save(booking);

        riskService.recordNoShow(booking.getPlayer().getId(), bookingId);

        Deposit deposit = depositRepository.findByBookingId(bookingId).orElse(null);
        if (deposit != null && deposit.getStatus() == DepositStatus.HELD) {
            deposit.setStatus(DepositStatus.FORFEITED);
            deposit.setForfeitReason("玩家爽约，定金扣除");
            depositRepository.save(deposit);
        }
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getSessionBookings(Long sessionId) {
        List<Booking> bookings = bookingRepository.findBySessionId(sessionId);
        return bookings.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getPlayerBookings(Long playerId) {
        List<Booking> bookings = bookingRepository.findByPlayerId(playerId);
        return bookings.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public long getConfirmedBookingCount(Long sessionId) {
        return bookingRepository.countConfirmedBookingsBySessionId(sessionId);
    }

    private BookingResponse convertToResponse(Booking booking) {
        BookingResponse response = new BookingResponse();
        response.setId(booking.getId());
        response.setSessionId(booking.getSession().getId());
        response.setScriptName(booking.getSession().getScript().getName());
        response.setPlayerId(booking.getPlayer().getId());
        response.setPlayerName(booking.getPlayer().getNickname());
        if (booking.getAssignedCharacter() != null) {
            response.setAssignedCharacterId(booking.getAssignedCharacter().getId());
            response.setAssignedCharacterName(booking.getAssignedCharacter().getName());
        }
        response.setStatus(booking.getStatus().name());
        response.setDepositPaid(booking.getDepositPaid());
        response.setFullPricePaid(booking.getFullPricePaid());
        response.setIsDepositRefunded(booking.getIsDepositRefunded());
        response.setBookingTime(booking.getBookingTime());
        response.setCancelTime(booking.getCancelTime());
        response.setCancelReason(booking.getCancelReason());
        response.setNotes(booking.getNotes());
        response.setCheckInTime(booking.getCheckInTime());
        response.setCheckOutTime(booking.getCheckOutTime());
        response.setStartTime(booking.getSession().getStartTime());
        response.setCreatedAt(booking.getCreatedAt());
        return response;
    }
}
