package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.FollowTaskStatusRequest;
import com.wedding.suite.dto.response.FollowupDetailVO;
import com.wedding.suite.entity.FollowTaskEntity;
import com.wedding.suite.entity.WeddingEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.FollowTaskRepository;
import com.wedding.suite.repository.WeddingRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class FollowupService {

    private final WeddingRepository weddingRepo;
    private final FollowTaskRepository taskRepo;
    private final WeddingService weddingService;

    public FollowupService(WeddingRepository weddingRepo, FollowTaskRepository taskRepo, WeddingService weddingService) {
        this.weddingRepo = weddingRepo;
        this.taskRepo = taskRepo;
        this.weddingService = weddingService;
    }

    public FollowupDetailVO detail(Long weddingId) {
        WeddingEntity w = weddingRepo.findById(weddingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "婚礼不存在"));
        long countdown = ChronoUnit.DAYS.between(LocalDate.now(), w.getWeddingDate());
        List<FollowTaskEntity> tasks = taskRepo.findByWeddingId(weddingId);
        return new FollowupDetailVO(weddingService.toVO(w), countdown, tasks);
    }

    public List<FollowTaskEntity> list() {
        return taskRepo.findAll();
    }

    public FollowTaskEntity updateTask(Long taskId, FollowTaskStatusRequest req) {
        FollowTaskEntity t = taskRepo.findById(taskId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "任务不存在"));
        t.setStatus(req.getStatus());
        return taskRepo.save(t);
    }
}
