package com.iccert.task.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iccert.task.entity.TechnicianTraining;
import com.iccert.task.mapper.TechnicianTrainingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 技术员培训记录服务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TrainingService {

    private final TechnicianTrainingMapper trainingMapper;

    public List<TechnicianTraining> listAll() {
        return trainingMapper.selectList(
                new LambdaQueryWrapper<TechnicianTraining>()
                        .orderByDesc(TechnicianTraining::getTrainingDate));
    }

    public List<TechnicianTraining> listByTechnician(Long technicianId) {
        return trainingMapper.selectList(
                new LambdaQueryWrapper<TechnicianTraining>()
                        .eq(TechnicianTraining::getTechnicianId, technicianId)
                        .orderByDesc(TechnicianTraining::getTrainingDate));
    }

    public TechnicianTraining getById(Long id) {
        return trainingMapper.selectById(id);
    }

    public TechnicianTraining create(TechnicianTraining training) {
        if (training.getTrainingDate() == null) {
            throw new IllegalArgumentException("培训日期不能为空");
        }
        if (training.getCreateTime() == null) {
            training.setCreateTime(LocalDateTime.now());
        }
        trainingMapper.insert(training);
        log.info("[培训记录] 新增培训: technicianId={}, title={}",
                training.getTechnicianId(), training.getTrainingTitle());
        return training;
    }

    public TechnicianTraining update(TechnicianTraining training) {
        trainingMapper.updateById(training);
        return training;
    }

    public boolean delete(Long id) {
        return trainingMapper.deleteById(id) > 0;
    }
}
