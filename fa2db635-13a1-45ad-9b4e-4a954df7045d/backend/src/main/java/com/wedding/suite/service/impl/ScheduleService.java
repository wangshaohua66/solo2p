package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.ScheduleCheckRequest;
import com.wedding.suite.dto.request.ScheduleMoveRequest;
import com.wedding.suite.dto.response.ConflictResultVO;
import com.wedding.suite.dto.response.ResourceVO;
import com.wedding.suite.entity.PropEntity;
import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.entity.StaffEntity;
import com.wedding.suite.entity.VenueEntity;
import com.wedding.suite.enums.ResourceType;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.PropRepository;
import com.wedding.suite.repository.ScheduleTaskRepository;
import com.wedding.suite.repository.StaffRepository;
import com.wedding.suite.repository.VenueRepository;
import com.wedding.suite.util.ScheduleConflictDetector;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ScheduleService {

    private final ScheduleTaskRepository scheduleRepo;
    private final StaffRepository staffRepo;
    private final VenueRepository venueRepo;
    private final PropRepository propRepo;
    private final ScheduleConflictDetector detector;

    public ScheduleService(ScheduleTaskRepository scheduleRepo, StaffRepository staffRepo,
                          VenueRepository venueRepo, PropRepository propRepo,
                          ScheduleConflictDetector detector) {
        this.scheduleRepo = scheduleRepo;
        this.staffRepo = staffRepo;
        this.venueRepo = venueRepo;
        this.propRepo = propRepo;
        this.detector = detector;
    }

    public List<ScheduleTaskEntity> list(String resourceType, Long storeId, String from, String to) {
        List<ScheduleTaskEntity> tasks = scheduleRepo.findAll();
        if (resourceType != null && !resourceType.isBlank()) {
            ResourceType rt = ResourceType.valueOf(resourceType);
            tasks = tasks.stream().filter(t -> t.getResourceType() == rt).collect(Collectors.toList());
        }
        if (storeId != null) {
            Set<Long> staffIds = staffRepo.findByStoreId(storeId).stream().map(StaffEntity::getId).collect(Collectors.toSet());
            Set<Long> venueIds = venueRepo.findByStoreId(storeId).stream().map(VenueEntity::getId).collect(Collectors.toSet());
            Set<Long> propIds = propRepo.findByStoreId(storeId).stream().map(PropEntity::getId).collect(Collectors.toSet());
            tasks = tasks.stream().filter(t -> switch (t.getResourceType()) {
                case STAFF -> staffIds.contains(t.getResourceId());
                case VENUE -> venueIds.contains(t.getResourceId());
                case PROP -> propIds.contains(t.getResourceId());
            }).collect(Collectors.toList());
        }
        if (from != null && !from.isBlank()) {
            LocalDateTime f = parse(from);
            tasks = tasks.stream().filter(t -> !t.getEndTime().isBefore(f)).collect(Collectors.toList());
        }
        if (to != null && !to.isBlank()) {
            LocalDateTime tt = parse(to);
            tasks = tasks.stream().filter(t -> !t.getStartTime().isAfter(tt)).collect(Collectors.toList());
        }
        return tasks;
    }

    public ConflictResultVO check(ScheduleCheckRequest req) {
        long startNs = System.nanoTime();
        ResourceType type = req.getResourceType();
        LocalDateTime s = parse(req.getStart());
        LocalDateTime e = parse(req.getEnd());
        List<ScheduleTaskEntity> all = scheduleRepo.findAll();
        List<ScheduleTaskEntity> conflicts = detector.detectConflict(all, type, req.getResourceId(), s, e);
        List<ResourceVO> candidates = candidatesOf(req.getStoreId(), type);
        List<ResourceVO> alternatives = detector.recommendAlternatives(candidates, all, type, s, e, req.getResourceId());
        long costMs = (System.nanoTime() - startNs) / 1_000_000L;
        return new ConflictResultVO(!conflicts.isEmpty(), conflicts, alternatives, costMs);
    }

    public ScheduleTaskEntity move(Long taskId, ScheduleMoveRequest req) {
        ScheduleTaskEntity t = scheduleRepo.findById(taskId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "档期任务不存在"));
        t.setStartTime(parse(req.getStart()));
        t.setEndTime(parse(req.getEnd()));
        return scheduleRepo.save(t);
    }

    public void remove(Long taskId) {
        scheduleRepo.deleteById(taskId);
    }

    private List<ResourceVO> candidatesOf(Long storeId, ResourceType type) {
        List<ResourceVO> list = new ArrayList<>();
        switch (type) {
            case STAFF -> staffRepo.findByStoreId(storeId).forEach(s ->
                    list.add(new ResourceVO(s.getId(), "STAFF", s.getName(), s.getStoreId(), s.getRole().name())));
            case VENUE -> venueRepo.findByStoreId(storeId).forEach(v ->
                    list.add(new ResourceVO(v.getId(), "VENUE", v.getName(), v.getStoreId(), "容量" + v.getCapacity() + "桌")));
            case PROP -> propRepo.findByStoreId(storeId).forEach(p ->
                    list.add(new ResourceVO(p.getId(), "PROP", p.getName(), p.getStoreId(), "库存" + p.getStock())));
        }
        return list;
    }

    private LocalDateTime parse(String s) {
        return LocalDateTime.parse(s);
    }
}
