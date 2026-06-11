package com.scriptkill.service;

import com.scriptkill.dto.script.ClueResponse;
import com.scriptkill.entity.*;
import com.scriptkill.entity.enums.ClueTriggerType;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.ClueRepository;
import com.scriptkill.repository.SessionClueLogRepository;
import com.scriptkill.repository.SessionRepository;
import com.scriptkill.repository.StageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ClueService {

    private final ClueRepository clueRepository;
    private final SessionRepository sessionRepository;
    private final SessionClueLogRepository sessionClueLogRepository;
    private final StageRepository stageRepository;

    public ClueService(ClueRepository clueRepository,
                       SessionRepository sessionRepository,
                       SessionClueLogRepository sessionClueLogRepository,
                       StageRepository stageRepository) {
        this.clueRepository = clueRepository;
        this.sessionRepository = sessionRepository;
        this.sessionClueLogRepository = sessionClueLogRepository;
        this.stageRepository = stageRepository;
    }

    @Transactional(readOnly = true)
    public List<ClueResponse> getAvailableClues(Long sessionId) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        List<Clue> allClues = clueRepository.findByScriptIdOrderBySortOrderAsc(session.getScript().getId());

        List<ClueResponse> result = new ArrayList<>();
        for (Clue clue : allClues) {
            boolean alreadyTriggered = sessionClueLogRepository
                    .existsBySessionIdAndClueId(sessionId, clue.getId());

            ClueResponse response = convertToResponse(clue);
            if (alreadyTriggered) {
                result.add(response);
            }
        }

        return result;
    }

    @Transactional
    public ClueResponse triggerClue(Long sessionId, Long clueId, Long dmUserId, String triggerType) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        Clue clue = clueRepository.findById(clueId)
                .orElseThrow(() -> new BusinessException("线索不存在"));

        if (!clue.getScript().getId().equals(session.getScript().getId())) {
            throw new BusinessException("线索不属于当前剧本");
        }

        boolean alreadyTriggered = sessionClueLogRepository
                .existsBySessionIdAndClueId(sessionId, clueId);

        if (alreadyTriggered) {
            throw new BusinessException("该线索已经触发过");
        }

        SessionClueLog log = new SessionClueLog();
        log.setSession(session);
        log.setClue(clue);
        log.setTriggeredBy(dmUserId);
        log.setTriggeredAt(LocalDateTime.now());
        log.setTriggerType(triggerType);
        log.setStageIndex(session.getCurrentStageIndex());
        sessionClueLogRepository.save(log);

        return convertToResponse(clue);
    }

    @Transactional
    public List<ClueResponse> getTriggerableCluesByTime(Long sessionId, int elapsedMinutes) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        List<Clue> timeClues = clueRepository.findByScriptIdAndTriggerType(
                session.getScript().getId(), ClueTriggerType.TIME);

        List<ClueResponse> result = new ArrayList<>();
        for (Clue clue : timeClues) {
            if (clue.getTriggerTimeMinutes() != null &&
                    clue.getTriggerTimeMinutes() <= elapsedMinutes) {
                boolean alreadyTriggered = sessionClueLogRepository
                        .existsBySessionIdAndClueId(sessionId, clue.getId());
                if (!alreadyTriggered) {
                    result.add(convertToResponse(clue));
                }
            }
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<ClueResponse> getStageClues(Long sessionId) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        if (session.getCurrentStageId() == null) {
            return new ArrayList<>();
        }

        List<Clue> stageClues = clueRepository.findByStageIdOrderBySortOrderAsc(
                session.getCurrentStageId());

        return stageClues.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<ClueResponse> checkEventTrigger(Long sessionId, String eventName, Long dmUserId) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        List<Clue> eventClues = clueRepository.findByScriptIdAndTriggerType(
                session.getScript().getId(), ClueTriggerType.EVENT);

        List<ClueResponse> triggeredClues = new ArrayList<>();
        for (Clue clue : eventClues) {
            if (clue.getTriggerCondition() != null &&
                    clue.getTriggerCondition().contains(eventName)) {
                boolean alreadyTriggered = sessionClueLogRepository
                        .existsBySessionIdAndClueId(sessionId, clue.getId());
                if (!alreadyTriggered) {
                    SessionClueLog log = new SessionClueLog();
                    log.setSession(session);
                    log.setClue(clue);
                    log.setTriggeredBy(dmUserId);
                    log.setTriggeredAt(LocalDateTime.now());
                    log.setTriggerType("EVENT");
                    log.setStageIndex(session.getCurrentStageIndex());
                    log.setNotes("触发事件: " + eventName);
                    sessionClueLogRepository.save(log);

                    triggeredClues.add(convertToResponse(clue));
                }
            }
        }

        return triggeredClues;
    }

    @Transactional(readOnly = true)
    public List<ClueResponse> getClueTimeline(Long sessionId, LocalDateTime startTime,
                                              LocalDateTime endTime) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        List<SessionClueLog> logs = sessionClueLogRepository
                .findBySessionIdOrderByTriggeredAtAsc(sessionId);

        return logs.stream()
                .filter(log -> {
                    if (startTime != null && log.getTriggeredAt().isBefore(startTime)) {
                        return false;
                    }
                    return endTime == null || !log.getTriggeredAt().isAfter(endTime);
                })
                .map(log -> {
                    ClueResponse resp = convertToResponse(log.getClue());
                    resp.setTriggeredAt(log.getTriggeredAt());
                    resp.setTriggeredBy(log.getTriggeredBy());
                    resp.setTriggerType(log.getTriggerType());
                    resp.setStageIndex(log.getStageIndex());
                    return resp;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClueResponse> getAllCluesForDm(Long scriptId) {
        List<Clue> clues = clueRepository.findByScriptIdOrderBySortOrderAsc(scriptId);
        return clues.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ClueResponse getClueDetail(Long clueId) {
        Clue clue = clueRepository.findById(clueId)
                .orElseThrow(() -> new BusinessException("线索不存在"));
        return convertToResponse(clue);
    }

    private ClueResponse convertToResponse(Clue clue) {
        ClueResponse response = new ClueResponse();
        response.setId(clue.getId());
        response.setTitle(clue.getTitle());
        response.setContent(clue.getContent());
        response.setClueLevel(clue.getClueLevel());
        response.setTriggerType(clue.getTriggerType().name());
        response.setTriggerCondition(clue.getTriggerCondition());
        response.setTriggerTimeMinutes(clue.getTriggerTimeMinutes());
        response.setTriggerLocation(clue.getTriggerLocation());
        response.setIsKeyClue(clue.getIsKeyClue());
        response.setSortOrder(clue.getSortOrder());
        response.setImageUrl(clue.getImageUrl());
        response.setDmNote(clue.getDmNote());
        response.setStageId(clue.getStage() != null ? clue.getStage().getId() : null);
        response.setCharacterId(clue.getCharacter() != null ? clue.getCharacter().getId() : null);
        return response;
    }
}
