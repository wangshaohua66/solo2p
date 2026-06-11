package com.scriptkill.service;

import com.scriptkill.dto.schedule.DMScheduleResponse;
import com.scriptkill.dto.schedule.MonthlySalary;
import com.scriptkill.entity.DMSchedule;
import com.scriptkill.entity.GameSession;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.Role;
import com.scriptkill.entity.enums.SessionStatus;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.DMScheduleRepository;
import com.scriptkill.repository.SessionRepository;
import com.scriptkill.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DMScheduleService {

    private final DMScheduleRepository dmScheduleRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    private static final int BASE_SESSION_FEE = 100;
    private static final double COMMISSION_RATE = 0.3;

    public DMScheduleService(DMScheduleRepository dmScheduleRepository,
                             UserRepository userRepository,
                             SessionRepository sessionRepository) {
        this.dmScheduleRepository = dmScheduleRepository;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public DMScheduleResponse createSchedule(Long dmId, LocalDate date,
                                             LocalTime startTime, LocalTime endTime,
                                             String shiftType, Long sessionId,
                                             Integer baseSalary) {
        User dm = userRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException("DM不存在"));

        if (dm.getRole() != Role.DM && dm.getRole() != Role.STORE_MANAGER) {
            throw new BusinessException("该用户不是DM");
        }

        DMSchedule schedule = new DMSchedule();
        schedule.setDm(dm);
        schedule.setScheduleDate(date);
        schedule.setStartTime(startTime);
        schedule.setEndTime(endTime);
        schedule.setShiftType(shiftType);
        schedule.setBaseSalary(baseSalary != null ? baseSalary : 0);
        schedule.setStatus("SCHEDULED");

        if (sessionId != null) {
            GameSession session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new BusinessException("会话不存在"));
            schedule.setSession(session);
            schedule.setDifficultyCoefficient(session.getDifficultyFactor());
        }

        schedule = dmScheduleRepository.save(schedule);

        return convertToResponse(schedule);
    }

    @Transactional
    public DMScheduleResponse calculateCommission(Long scheduleId) {
        DMSchedule schedule = dmScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException("排班不存在"));

        if (schedule.getSession() == null) {
            schedule.setCommissionAmount(0);
            schedule.setTotalEarnings(schedule.getBaseSalary() + schedule.getBonus());
            dmScheduleRepository.save(schedule);
            return convertToResponse(schedule);
        }

        GameSession session = schedule.getSession();
        int playerCount = (int) session.getCurrentPlayersCount();
        double difficultyCoeff = schedule.getDifficultyCoefficient();

        int commission = (int) (BASE_SESSION_FEE +
                (playerCount * session.getPricePerPerson() * COMMISSION_RATE * difficultyCoeff));

        schedule.setPlayerCount(playerCount);
        schedule.setCommissionAmount(commission);

        int totalEarnings = schedule.getBaseSalary() + commission +
                (schedule.getBonus() != null ? schedule.getBonus() : 0);
        schedule.setTotalEarnings(totalEarnings);

        dmScheduleRepository.save(schedule);

        return convertToResponse(schedule);
    }

    @Transactional(readOnly = true)
    public List<DMScheduleResponse> getDmSchedules(Long dmId, LocalDate startDate, LocalDate endDate) {
        List<DMSchedule> schedules = dmScheduleRepository
                .findByDmIdAndScheduleDateBetween(dmId, startDate, endDate);
        return schedules.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DMScheduleResponse> getSchedulesByDate(LocalDate date) {
        List<DMSchedule> schedules = dmScheduleRepository.findByScheduleDate(date);
        return schedules.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MonthlySalary generateMonthlySalary(Long dmId, int year, int month) {
        LocalDate startDate = LocalDate.of(year, month, 1);
        LocalDate endDate = startDate.plusMonths(1).minusDays(1);

        List<DMSchedule> schedules = dmScheduleRepository
                .findByDmIdAndScheduleDateBetween(dmId, startDate, endDate);

        User dm = userRepository.findById(dmId)
                .orElseThrow(() -> new BusinessException("DM不存在"));

        MonthlySalary salary = new MonthlySalary();
        salary.setDmId(dmId);
        salary.setDmName(dm.getNickname());
        salary.setYear(year);
        salary.setMonth(month);
        salary.setSessionCount(schedules.size());

        int totalPlayers = schedules.stream()
                .mapToInt(s -> s.getPlayerCount() != null ? s.getPlayerCount() : 0)
                .sum();
        salary.setTotalPlayers(totalPlayers);

        int totalBaseSalary = schedules.stream()
                .mapToInt(s -> s.getBaseSalary() != null ? s.getBaseSalary() : 0)
                .sum();
        salary.setTotalBaseSalary(totalBaseSalary);

        int totalCommission = schedules.stream()
                .mapToInt(s -> s.getCommissionAmount() != null ? s.getCommissionAmount() : 0)
                .sum();
        salary.setTotalCommission(totalCommission);

        int totalBonus = schedules.stream()
                .mapToInt(s -> s.getBonus() != null ? s.getBonus() : 0)
                .sum();
        salary.setTotalBonus(totalBonus);

        salary.setTotalSalary(totalBaseSalary + totalCommission + totalBonus);

        salary.setSchedules(schedules.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList()));

        return salary;
    }

    @Transactional
    public void markAsPaid(Long scheduleId) {
        DMSchedule schedule = dmScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException("排班不存在"));
        schedule.setIsPaid(true);
        dmScheduleRepository.save(schedule);
    }

    @Transactional
    public DMScheduleResponse markSessionCompleted(Long scheduleId) {
        DMSchedule schedule = dmScheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new BusinessException("排班不存在"));

        schedule.setStatus("COMPLETED");
        calculateCommission(scheduleId);

        return convertToResponse(schedule);
    }

    private DMScheduleResponse convertToResponse(DMSchedule schedule) {
        DMScheduleResponse response = new DMScheduleResponse();
        response.setId(schedule.getId());
        response.setDmId(schedule.getDm().getId());
        response.setDmName(schedule.getDm().getNickname());
        if (schedule.getSession() != null) {
            response.setSessionId(schedule.getSession().getId());
            response.setScriptName(schedule.getSession().getScript().getName());
        }
        response.setScheduleDate(schedule.getScheduleDate());
        response.setStartTime(schedule.getStartTime());
        response.setEndTime(schedule.getEndTime());
        response.setShiftType(schedule.getShiftType());
        response.setCommissionAmount(schedule.getCommissionAmount());
        response.setDifficultyCoefficient(schedule.getDifficultyCoefficient());
        response.setPlayerCount(schedule.getPlayerCount());
        response.setBaseSalary(schedule.getBaseSalary());
        response.setBonus(schedule.getBonus());
        response.setTotalEarnings(schedule.getTotalEarnings());
        response.setIsPaid(schedule.getIsPaid());
        response.setStatus(schedule.getStatus());
        response.setNotes(schedule.getNotes());
        return response;
    }
}
