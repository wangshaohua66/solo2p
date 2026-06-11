package com.glassstudio.service;

import com.glassstudio.dto.IncidentCreateDTO;
import com.glassstudio.dto.KilnOpenDTO;
import com.glassstudio.entity.*;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.exception.ValidationException;
import com.glassstudio.mapper.IncidentMapper;
import com.glassstudio.mapper.KilnOpenRecordMapper;
import com.glassstudio.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final KilnOpenRecordRepository kilnOpenRecordRepository;
    private final ScheduleRepository scheduleRepository;
    private final MemberRepository memberRepository;
    private final IncidentMapper incidentMapper;
    private final KilnOpenRecordMapper kilnOpenRecordMapper;
    private final MemberService memberService;

    public List<Incident> getAllIncidents() {
        return incidentRepository.findAll();
    }

    public Incident getIncidentById(Long id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("事件不存在"));
    }

    @Transactional
    public Incident createIncident(IncidentCreateDTO dto) {
        Incident incident = incidentMapper.toEntity(dto);
        incident.setResolved(false);
        if (incident.getSeverity() == null) {
            incident.setSeverity(IncidentSeverity.MEDIUM);
        }
        return incidentRepository.save(incident);
    }

    @Transactional
    public Incident resolveIncident(Long id) {
        Incident incident = getIncidentById(id);
        incident.setResolved(true);
        incident.setResolvedAt(LocalDateTime.now());
        return incidentRepository.save(incident);
    }

    public List<KilnOpenRecord> getAllKilnOpenRecords() {
        return kilnOpenRecordRepository.findAll();
    }

    public KilnOpenRecord getKilnOpenRecordById(Long id) {
        return kilnOpenRecordRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("开窑记录不存在"));
    }

    @Transactional
    public KilnOpenRecord recordKilnOpen(KilnOpenDTO dto) {
        KilnOpenRecord record = kilnOpenRecordMapper.toEntity(dto);

        if (record.getOpenTime() == null) {
            record.setOpenTime(LocalDateTime.now());
        }

        boolean isViolation = detectViolation(record);
        record.setIsViolation(isViolation);

        KilnOpenRecord savedRecord = kilnOpenRecordRepository.save(record);

        if (isViolation) {
            createViolationIncident(savedRecord);
        }

        return savedRecord;
    }

    private boolean detectViolation(KilnOpenRecord record) {
        if (record.getScheduleId() == null) {
            return true;
        }

        Schedule schedule = scheduleRepository.findById(record.getScheduleId())
                .orElse(null);

        if (schedule == null) {
            return true;
        }

        if (schedule.getStatus() != ScheduleStatus.FIRING &&
                schedule.getStatus() != ScheduleStatus.COOLING) {
            return false;
        }

        if (record.getTemperatureAtOpen() != null &&
                record.getTemperatureAtOpen().compareTo(new BigDecimal("100")) > 0) {
            return true;
        }

        return false;
    }

    private void createViolationIncident(KilnOpenRecord record) {
        Incident incident = Incident.builder()
                .kilnOpenRecordId(record.getId())
                .memberId(record.getOperatorId())
                .type(IncidentType.UNAUTHORIZED_OPEN)
                .severity(IncidentSeverity.HIGH)
                .description("违规开窑：窑炉ID " + record.getKilnId())
                .resolved(false)
                .build();

        incidentRepository.save(incident);

        memberService.addToWatchlist(record.getOperatorId(), "违规开窑", incident.getId(), 30);
    }

    @Transactional
    public void deleteIncident(Long id) {
        if (!incidentRepository.existsById(id)) {
            throw new NotFoundException("事件不存在");
        }
        incidentRepository.deleteById(id);
    }
}
