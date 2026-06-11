package com.glassstudio.service;

import com.glassstudio.dto.ScheduleCreateDTO;
import com.glassstudio.dto.ScheduleUpdateDTO;
import com.glassstudio.entity.*;
import com.glassstudio.exception.ConflictException;
import com.glassstudio.exception.ForbiddenException;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class KilnScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final KilnRepository kilnRepository;
    private final MemberRepository memberRepository;
    private final FiringCurveRepository firingCurveRepository;
    private final MemberRoleConfigRepository memberRoleConfigRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    public Page<Schedule> getSchedules(Long kilnId, LocalDateTime startDate, LocalDateTime endDate, ScheduleStatus status, Pageable pageable) {
        return scheduleRepository.findAll(pageable);
    }

    public Schedule getScheduleById(Long id) {
        return scheduleRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("排程不存在"));
    }

    public List<Schedule> checkConflict(Long kilnId, LocalDateTime start, LocalDateTime end) {
        List<Schedule> allSchedules = scheduleRepository.findByKilnIdAndStartTimeBetween(kilnId, start, end);
        return allSchedules.stream()
                .filter(s -> !s.getStatus().equals(ScheduleStatus.CANCELLED))
                .filter(s -> isOverlapping(s, start, end))
                .toList();
    }

    private boolean isOverlapping(Schedule schedule, LocalDateTime start, LocalDateTime end) {
        return schedule.getStartTime().isBefore(end) && schedule.getEndTime().isAfter(start);
    }

    @Transactional
    public Schedule createSchedule(ScheduleCreateDTO dto) {
        Kiln kiln = kilnRepository.findById(dto.getKilnId())
                .orElseThrow(() -> new NotFoundException("窑炉不存在"));

        Member member = memberRepository.findById(dto.getMemberId())
                .orElseThrow(() -> new NotFoundException("会员不存在"));

        firingCurveRepository.findById(dto.getCurveId())
                .orElseThrow(() -> new NotFoundException("烧成曲线不存在"));

        LocalDateTime startTime = LocalDateTime.parse(dto.getStartTime());
        LocalDateTime endTime = LocalDateTime.parse(dto.getEndTime());

        validateMemberPermissions(member, kiln, startTime, endTime);

        List<Schedule> conflicts = checkConflict(dto.getKilnId(), startTime, endTime);
        if (!conflicts.isEmpty()) {
            throw new ConflictException("时间段存在冲突");
        }

        String lockKey = "schedule:lock:" + dto.getKilnId() + ":" + System.currentTimeMillis();
        Boolean locked = redisTemplate.opsForValue().setIfAbsent(lockKey, "locked", 10, TimeUnit.SECONDS);

        if (locked == null || !locked) {
            throw new ConflictException("获取分布式锁失败，请稍后重试");
        }

        try {
            conflicts = checkConflict(dto.getKilnId(), startTime, endTime);
            if (!conflicts.isEmpty()) {
                throw new ConflictException("时间段存在冲突");
            }

            Schedule schedule = Schedule.builder()
                    .kilnId(dto.getKilnId())
                    .memberId(dto.getMemberId())
                    .curveId(dto.getCurveId())
                    .startTime(startTime)
                    .endTime(endTime)
                    .status(ScheduleStatus.PENDING)
                    .workpieceCount(dto.getWorkpieceCount() != null ? dto.getWorkpieceCount() : 1)
                    .note(dto.getNote())
                    .build();

            return scheduleRepository.save(schedule);
        } finally {
            redisTemplate.delete(lockKey);
        }
    }

    private void validateMemberPermissions(Member member, Kiln kiln, LocalDateTime startTime, LocalDateTime endTime) {
        MemberRoleConfig config = memberRoleConfigRepository.findByRole(member.getRole())
                .orElseThrow(() -> new ForbiddenException("角色配置不存在"));

        List<String> allowedTypes = Arrays.asList(config.getAllowedKilnTypes().split(","));
        if (!allowedTypes.contains(kiln.getType().name())) {
            throw new ForbiddenException("该角色无权限使用此类型窑炉");
        }

        long daysUntilStart = ChronoUnit.DAYS.between(LocalDateTime.now(), startTime);
        if (daysUntilStart > config.getMaxAdvanceDays()) {
            throw new ForbiddenException("预约时间超出最大提前天数限制");
        }

        long durationHours = ChronoUnit.HOURS.between(startTime, endTime);
        if (durationHours > config.getMaxDurationHours()) {
            throw new ForbiddenException("预约时长超出最大时长限制");
        }
    }

    @Transactional
    public Schedule updateSchedule(Long id, ScheduleUpdateDTO dto) {
        Schedule schedule = getScheduleById(id);

        if (dto.getStartTime() != null) {
            schedule.setStartTime(LocalDateTime.parse(dto.getStartTime()));
        }
        if (dto.getEndTime() != null) {
            schedule.setEndTime(LocalDateTime.parse(dto.getEndTime()));
        }
        if (dto.getWorkpieceCount() != null) {
            schedule.setWorkpieceCount(dto.getWorkpieceCount());
        }
        if (dto.getNote() != null) {
            schedule.setNote(dto.getNote());
        }
        if (dto.getStatus() != null) {
            schedule.setStatus(dto.getStatus());
        }

        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void deleteSchedule(Long id) {
        if (!scheduleRepository.existsById(id)) {
            throw new NotFoundException("排程不存在");
        }
        scheduleRepository.deleteById(id);
    }

    @Transactional
    public Schedule overrideSchedule(Long id, String reason) {
        Schedule originalSchedule = getScheduleById(id);
        originalSchedule.setStatus(ScheduleStatus.CANCELLED);
        originalSchedule.setNote(originalSchedule.getNote() + " [管理员强制取消原因: " + reason + "]");
        scheduleRepository.save(originalSchedule);
        return originalSchedule;
    }
}
