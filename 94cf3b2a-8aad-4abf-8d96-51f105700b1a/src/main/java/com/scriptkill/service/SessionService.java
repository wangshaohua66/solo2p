package com.scriptkill.service;

import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.session.SessionCreateRequest;
import com.scriptkill.dto.session.SessionEventResponse;
import com.scriptkill.dto.session.SessionResponse;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.*;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionEventRepository sessionEventRepository;
    private final ScriptRepository scriptRepository;
    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final StageRepository stageRepository;

    public SessionService(SessionRepository sessionRepository,
                          SessionEventRepository sessionEventRepository,
                          ScriptRepository scriptRepository,
                          UserRepository userRepository,
                          BookingRepository bookingRepository,
                          StageRepository stageRepository) {
        this.sessionRepository = sessionRepository;
        this.sessionEventRepository = sessionEventRepository;
        this.scriptRepository = scriptRepository;
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.stageRepository = stageRepository;
    }

    @Transactional
    public SessionResponse createSession(SessionCreateRequest request) {
        Script script = scriptRepository.findById(request.getScriptId())
                .orElseThrow(() -> new BusinessException("剧本不存在"));

        User dm = userRepository.findById(request.getDmId())
                .orElseThrow(() -> new BusinessException("DM不存在"));

        if (dm.getRole() != Role.DM && dm.getRole() != Role.STORE_MANAGER && dm.getRole() != Role.ADMIN) {
            throw new BusinessException("该用户不是DM");
        }

        GameSession session = new GameSession();
        session.setScript(script);
        session.setDm(dm);
        session.setStatus(SessionStatus.NOT_STARTED);
        session.setStartTime(request.getStartTime());
        session.setRoomNumber(request.getRoomNumber());
        session.setMaxPlayers(request.getMaxPlayers() != null ? request.getMaxPlayers() : script.getMaxPlayers());
        session.setCurrentPlayersCount(0);
        session.setDifficultyFactor(request.getDifficultyFactor() != null ? request.getDifficultyFactor() : 1.0);
        session.setDepositAmount(request.getDepositAmount() != null ? request.getDepositAmount() : 0);
        session.setPricePerPerson(request.getPricePerPerson() != null ? request.getPricePerPerson() : 0);
        session.setNotes(request.getNotes());
        session.setIsArchived(false);

        List<Stage> stages = stageRepository.findByScriptIdOrderByStageOrderAsc(script.getId());
        if (!stages.isEmpty()) {
            session.setCurrentStageId(stages.get(0).getId());
            session.setCurrentStageIndex(0);
        }

        session = sessionRepository.save(session);

        recordEvent(session, "SESSION_CREATED", null, SessionStatus.NOT_STARTED,
                dm.getId(), "创建开本会话", null);

        return convertToResponse(session);
    }

    @Transactional(readOnly = true)
    public PageResult<SessionResponse> listSessions(int page, int size, String status) {
        Pageable pageable = PageRequest.of(page, size);
        Page<GameSession> sessionPage;

        if (status != null && !status.isEmpty()) {
            sessionPage = sessionRepository.findByStatus(SessionStatus.valueOf(status), pageable);
        } else {
            sessionPage = sessionRepository.findAll(pageable);
        }

        List<SessionResponse> content = sessionPage.getContent().stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());

        return new PageResult<>(
                content,
                sessionPage.getNumber(),
                sessionPage.getSize(),
                sessionPage.getTotalElements(),
                sessionPage.getTotalPages(),
                sessionPage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public SessionResponse getSessionDetail(Long id) {
        GameSession session = sessionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("会话不存在"));
        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse startMatching(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);
        validateStatusTransition(session.getStatus(), SessionStatus.MATCHING);

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.MATCHING);
        sessionRepository.save(session);

        recordEvent(session, "START_MATCHING", fromStatus, SessionStatus.MATCHING,
                userId, "开始拼场", null);

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse confirmSession(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);
        validateStatusTransition(session.getStatus(), SessionStatus.CONFIRMED);

        long confirmedCount = bookingRepository.countConfirmedBookingsBySessionId(sessionId);
        if (confirmedCount < session.getScript().getMinPlayers()) {
            throw new BusinessException("玩家人数不足，无法确认开本");
        }

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.CONFIRMED);
        sessionRepository.save(session);

        recordEvent(session, "SESSION_CONFIRMED", fromStatus, SessionStatus.CONFIRMED,
                userId, "确认开本，首发确认完成", null);

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse startPlaying(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);
        validateStatusTransition(session.getStatus(), SessionStatus.PLAYING);

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.PLAYING);
        session.setStartTime(LocalDateTime.now());
        sessionRepository.save(session);

        recordEvent(session, "START_PLAYING", fromStatus, SessionStatus.PLAYING,
                userId, "游戏开始", null);

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse startReviewing(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);
        validateStatusTransition(session.getStatus(), SessionStatus.REVIEWING);

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.REVIEWING);
        sessionRepository.save(session);

        recordEvent(session, "START_REVIEWING", fromStatus, SessionStatus.REVIEWING,
                userId, "开始复盘", null);

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse completeSession(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);
        validateStatusTransition(session.getStatus(), SessionStatus.COMPLETED);

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.COMPLETED);
        session.setEndTime(LocalDateTime.now());

        int confirmedCount = (int) bookingRepository.countConfirmedBookingsBySessionId(sessionId);
        int totalRevenue = confirmedCount * session.getPricePerPerson();
        int dmCommission = (int) (totalRevenue * 0.3 * session.getDifficultyFactor());

        session.setCurrentPlayersCount(confirmedCount);
        session.setTotalRevenue(totalRevenue);
        session.setDmCommission(dmCommission);

        sessionRepository.save(session);

        Script script = session.getScript();
        script.setTotalPlayedCount(script.getTotalPlayedCount() + 1);
        scriptRepository.save(script);

        recordEvent(session, "SESSION_COMPLETED", fromStatus, SessionStatus.COMPLETED,
                userId, "会话完成", null);

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse cancelSession(Long sessionId, Long userId, String reason) {
        GameSession session = getSessionEntity(sessionId);

        if (session.getStatus() == SessionStatus.COMPLETED ||
                session.getStatus() == SessionStatus.CANCELLED) {
            throw new BusinessException("当前状态不可取消");
        }

        SessionStatus fromStatus = session.getStatus();
        session.setStatus(SessionStatus.CANCELLED);
        session.setEndTime(LocalDateTime.now());
        sessionRepository.save(session);

        recordEvent(session, "SESSION_CANCELLED", fromStatus, SessionStatus.CANCELLED,
                userId, "取消会话，原因：" + reason, reason);

        return convertToResponse(session);
    }

    @Transactional(readOnly = true)
    public List<SessionEventResponse> getSessionEvents(Long sessionId) {
        if (!sessionRepository.existsById(sessionId)) {
            throw new BusinessException("会话不存在");
        }

        List<SessionEvent> events = sessionEventRepository.findBySessionIdOrderByEventTimestampAsc(sessionId);
        return events.stream()
                .map(this::convertEventToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public SessionResponse nextStage(Long sessionId, Long userId) {
        GameSession session = getSessionEntity(sessionId);

        if (session.getStatus() != SessionStatus.PLAYING &&
                session.getStatus() != SessionStatus.REVIEWING) {
            throw new BusinessException("当前状态不可切换阶段");
        }

        List<Stage> stages = stageRepository.findByScriptIdOrderByStageOrderAsc(session.getScript().getId());
        int currentIndex = session.getCurrentStageIndex();

        if (currentIndex >= stages.size() - 1) {
            throw new BusinessException("已经是最后一个阶段");
        }

        int nextIndex = currentIndex + 1;
        Stage nextStage = stages.get(nextIndex);

        session.setCurrentStageIndex(nextIndex);
        session.setCurrentStageId(nextStage.getId());
        sessionRepository.save(session);

        recordEvent(session, "STAGE_CHANGED", null, null,
                userId, "切换到阶段：" + nextStage.getName(),
                "{\"fromStage\":" + currentIndex + ",\"toStage\":" + nextIndex + "}");

        return convertToResponse(session);
    }

    private void recordEvent(GameSession session, String eventType, SessionStatus fromStatus,
                             SessionStatus toStatus, Long triggeredBy, String description, String eventData) {
        SessionEvent event = new SessionEvent();
        event.setSession(session);
        event.setEventType(eventType);
        event.setFromStatus(fromStatus);
        event.setToStatus(toStatus);
        event.setTriggeredBy(triggeredBy);
        event.setDescription(description);
        event.setEventData(eventData);
        event.setEventTimestamp(LocalDateTime.now());
        sessionEventRepository.save(event);
    }

    private void validateStatusTransition(SessionStatus current, SessionStatus target) {
        boolean valid = switch (current) {
            case NOT_STARTED -> target == SessionStatus.MATCHING || target == SessionStatus.CANCELLED;
            case MATCHING -> target == SessionStatus.CONFIRMED || target == SessionStatus.CANCELLED ||
                              target == SessionStatus.NOT_STARTED;
            case CONFIRMED -> target == SessionStatus.PLAYING || target == SessionStatus.CANCELLED;
            case PLAYING -> target == SessionStatus.REVIEWING || target == SessionStatus.COMPLETED;
            case REVIEWING -> target == SessionStatus.COMPLETED;
            case COMPLETED, CANCELLED -> false;
        };

        if (!valid) {
            throw new BusinessException("无法从 " + current + " 状态转换到 " + target + " 状态");
        }
    }

    public GameSession getSessionEntity(Long id) {
        return sessionRepository.findById(id)
                .orElseThrow(() -> new BusinessException("会话不存在"));
    }

    private SessionResponse convertToResponse(GameSession session) {
        SessionResponse response = new SessionResponse();
        response.setId(session.getId());
        response.setScriptId(session.getScript().getId());
        response.setScriptName(session.getScript().getName());
        response.setDmId(session.getDm().getId());
        response.setDmName(session.getDm().getNickname());
        response.setStatus(session.getStatus().name());
        response.setStartTime(session.getStartTime());
        response.setEndTime(session.getEndTime());
        response.setCurrentStageId(session.getCurrentStageId());
        response.setCurrentStageIndex(session.getCurrentStageIndex());
        response.setRoomNumber(session.getRoomNumber());
        response.setMaxPlayers(session.getMaxPlayers());
        response.setCurrentPlayersCount(session.getCurrentPlayersCount());
        response.setDifficultyFactor(session.getDifficultyFactor());
        response.setDepositAmount(session.getDepositAmount());
        response.setPricePerPerson(session.getPricePerPerson());
        response.setTotalRevenue(session.getTotalRevenue());
        response.setDmCommission(session.getDmCommission());
        response.setNotes(session.getNotes());
        response.setCreatedAt(session.getCreatedAt());
        response.setUpdatedAt(session.getUpdatedAt());
        return response;
    }

    private SessionEventResponse convertEventToResponse(SessionEvent event) {
        SessionEventResponse response = new SessionEventResponse();
        response.setId(event.getId());
        response.setSessionId(event.getSession().getId());
        response.setEventType(event.getEventType());
        response.setFromStatus(event.getFromStatus() != null ? event.getFromStatus().name() : null);
        response.setToStatus(event.getToStatus() != null ? event.getToStatus().name() : null);
        response.setTriggeredBy(event.getTriggeredBy());
        response.setEventData(event.getEventData());
        response.setDescription(event.getDescription());
        response.setEventTimestamp(event.getEventTimestamp());
        response.setIpAddress(event.getIpAddress());
        return response;
    }
}
