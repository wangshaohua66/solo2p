package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.WeddingCreateRequest;
import com.wedding.suite.dto.request.WeddingResourceItem;
import com.wedding.suite.dto.response.WeddingVO;
import com.wedding.suite.entity.*;
import com.wedding.suite.enums.ResourceType;
import com.wedding.suite.enums.ScheduleStatus;
import com.wedding.suite.enums.WeddingStage;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class WeddingService {

    private final WeddingRepository weddingRepo;
    private final StoreRepository storeRepo;
    private final PackageRepository packageRepo;
    private final StaffRepository staffRepo;
    private final VenueRepository venueRepo;
    private final PropRepository propRepo;
    private final ScheduleTaskRepository scheduleRepo;

    public WeddingService(WeddingRepository weddingRepo, StoreRepository storeRepo,
                           PackageRepository packageRepo, StaffRepository staffRepo,
                           VenueRepository venueRepo, PropRepository propRepo,
                           ScheduleTaskRepository scheduleRepo) {
        this.weddingRepo = weddingRepo;
        this.storeRepo = storeRepo;
        this.packageRepo = packageRepo;
        this.staffRepo = staffRepo;
        this.venueRepo = venueRepo;
        this.propRepo = propRepo;
        this.scheduleRepo = scheduleRepo;
    }

    public List<WeddingVO> list(String stage, Long storeId, String date, String keyword) {
        List<WeddingEntity> list = weddingRepo.findAll();
        if (stage != null && !stage.isBlank()) {
            list = list.stream().filter(w -> w.getStage().name().equals(stage)).collect(Collectors.toList());
        }
        if (storeId != null) {
            list = list.stream().filter(w -> storeId.equals(w.getStoreId())).collect(Collectors.toList());
        }
        if (date != null && !date.isBlank()) {
            list = list.stream().filter(w -> w.getWeddingDate().toString().equals(date)).collect(Collectors.toList());
        }
        if (keyword != null && !keyword.isBlank()) {
            list = list.stream().filter(w -> w.getCoupleName().contains(keyword)).collect(Collectors.toList());
        }
        return list.stream().map(this::toVO).collect(Collectors.toList());
    }

    public WeddingVO detail(Long id) {
        return toVO(get(id));
    }

    public WeddingVO create(WeddingCreateRequest req) {
        WeddingEntity w = WeddingEntity.builder()
                .coupleName(req.getCoupleName())
                .groomName(req.getGroomName())
                .brideName(req.getBrideName())
                .phone(req.getPhone())
                .weddingDate(LocalDate.parse(req.getWeddingDate()))
                .guests(req.getGuests())
                .stage(WeddingStage.CONSULT)
                .storeId(req.getStoreId())
                .plannerId(req.getPlannerId())
                .packageId(req.getPackageId())
                .quoteTotal(req.getQuoteTotal() == null ? null : new BigDecimal(req.getQuoteTotal().toString()))
                .progress(10)
                .build();
        w = weddingRepo.save(w);
        if (req.getResources() != null) {
            String date = req.getWeddingDate();
            for (WeddingResourceItem r : req.getResources()) {
                String name = resourceName(r.getType(), r.getId());
                ScheduleTaskEntity t = ScheduleTaskEntity.builder()
                        .resourceType(r.getType())
                        .resourceId(r.getId())
                        .resourceName(name)
                        .weddingId(w.getId())
                        .coupleName(w.getCoupleName())
                        .startTime(LocalDateTime.parse(date + "T08:00:00"))
                        .endTime(LocalDateTime.parse(date + "T20:00:00"))
                        .status(ScheduleStatus.BOOKED)
                        .build();
                scheduleRepo.save(t);
            }
        }
        return toVO(w);
    }

    public WeddingVO updateStage(Long id, String stage) {
        WeddingEntity w = get(id);
        WeddingStage st = WeddingStage.valueOf(stage);
        w.setStage(st);
        w.setProgress(progressOf(st));
        return toVO(weddingRepo.save(w));
    }

    public WeddingVO toVO(WeddingEntity w) {
        String storeName = storeRepo.findById(w.getStoreId()).map(StoreEntity::getName).orElse(null);
        String plannerName = w.getPlannerId() == null ? null
                : staffRepo.findById(w.getPlannerId()).map(StaffEntity::getName).orElse(null);
        String packageName = packageRepo.findById(w.getPackageId()).map(PackageEntity::getName).orElse(null);
        return new WeddingVO(w.getId(), w.getCoupleName(), w.getGroomName(), w.getBrideName(), w.getPhone(),
                w.getWeddingDate(), w.getGuests(), w.getStage().name(), w.getStoreId(), storeName,
                w.getPlannerId(), plannerName, w.getPackageId(), packageName, w.getQuoteTotal(),
                w.getProgress(), w.getCreatedAt());
    }

    private int progressOf(WeddingStage st) {
        switch (st) {
            case DELIVERY: return 100;
            case ONSITE: return 85;
            case PREPARE: return 65;
            case CONTRACT: return 45;
            case DESIGN: return 25;
            default: return 10;
        }
    }

    private String resourceName(ResourceType type, Long id) {
        switch (type) {
            case STAFF: return staffRepo.findById(id).map(StaffEntity::getName).orElse("人员#" + id);
            case VENUE: return venueRepo.findById(id).map(VenueEntity::getName).orElse("场地#" + id);
            case PROP: return propRepo.findById(id).map(PropEntity::getName).orElse("道具#" + id);
            default: return "资源#" + id;
        }
    }

    public WeddingEntity get(Long id) {
        return weddingRepo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "婚礼不存在"));
    }
}
