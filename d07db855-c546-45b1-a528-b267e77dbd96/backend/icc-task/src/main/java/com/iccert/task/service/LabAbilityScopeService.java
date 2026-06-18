package com.iccert.task.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.iccert.task.entity.LabAbilityScope;
import com.iccert.task.mapper.LabAbilityScopeMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 实验室能力认可范围维护服务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LabAbilityScopeService {

    private final LabAbilityScopeMapper abilityScopeMapper;

    public List<LabAbilityScope> listAll() {
        return abilityScopeMapper.selectList(
                new LambdaQueryWrapper<LabAbilityScope>()
                        .orderByDesc(LabAbilityScope::getAccreditationDate));
    }

    public List<LabAbilityScope> listByLab(Long labId) {
        return abilityScopeMapper.selectList(
                new LambdaQueryWrapper<LabAbilityScope>()
                        .eq(LabAbilityScope::getLabId, labId)
                        .orderByDesc(LabAbilityScope::getAccreditationDate));
    }

    public LabAbilityScope getById(Long id) {
        return abilityScopeMapper.selectById(id);
    }

    public LabAbilityScope create(LabAbilityScope scope) {
        if (scope.getStatus() == null) {
            scope.setStatus(1);
        }
        if (scope.getCreateTime() == null) {
            scope.setCreateTime(LocalDateTime.now());
        }
        scope.setUpdateTime(LocalDateTime.now());
        abilityScopeMapper.insert(scope);
        log.info("[能力范围] 新增能力项: labId={}, standard={}",
                scope.getLabId(), scope.getStandardCode());
        return scope;
    }

    public LabAbilityScope update(LabAbilityScope scope) {
        scope.setUpdateTime(LocalDateTime.now());
        abilityScopeMapper.updateById(scope);
        return scope;
    }

    public boolean delete(Long id) {
        return abilityScopeMapper.deleteById(id) > 0;
    }
}
