package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.common.PageResult;
import com.crew.dto.CrewCreateRequest;
import com.crew.dto.CrewUpdateRequest;
import com.crew.entity.CrewMember;
import com.crew.mapper.CrewMemberMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CrewService {

    private final CrewMemberMapper crewMemberMapper;

    @Cacheable(value = "crew", key = "#id")
    public CrewMember getById(Long id) {
        CrewMember crew = crewMemberMapper.selectById(id);
        if (crew == null) {
            throw new BusinessException(ErrorCode.CREW_NOT_FOUND);
        }
        return crew;
    }

    public PageResult<CrewMember> list(String type, String status, String base, int page, int size) {
        LambdaQueryWrapper<CrewMember> wrapper = new LambdaQueryWrapper<>();
        if (type != null) wrapper.eq(CrewMember::getType, type);
        if (status != null) wrapper.eq(CrewMember::getStatus, status);
        if (base != null) wrapper.eq(CrewMember::getBase, base);
        wrapper.orderByDesc(CrewMember::getCreateTime);

        IPage<CrewMember> result = crewMemberMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    @CacheEvict(value = "crew", key = "#result.id")
    public CrewMember create(CrewCreateRequest request) {
        long count = crewMemberMapper.selectCount(
                new LambdaQueryWrapper<CrewMember>().eq(CrewMember::getCrewCode, request.getCrewCode())
        );
        if (count > 0) {
            throw new BusinessException(ErrorCode.CREW_ALREADY_EXISTS);
        }

        CrewMember crew = new CrewMember();
        crew.setCrewCode(request.getCrewCode());
        crew.setName(request.getName());
        crew.setType(request.getType());
        crew.setRank(request.getRank());
        crew.setBase(request.getBase());
        crew.setLanguage(request.getLanguage());
        crew.setStatus(request.getStatus() != null ? request.getStatus() : "AVAILABLE");
        crew.setMonthlyFlightHours(0.0);
        crew.setWeeklyFlightHours(0.0);
        crew.setConsecutiveDutyDays(0);
        crew.setTimezoneOffset(0);
        crewMemberMapper.insert(crew);

        return crew;
    }

    @CacheEvict(value = "crew", key = "#id")
    public CrewMember update(Long id, CrewUpdateRequest request) {
        CrewMember crew = getById(id);

        if ("ON_DUTY".equals(crew.getStatus())) {
            throw new BusinessException(ErrorCode.CREW_IN_DUTY);
        }

        if (request.getName() != null) crew.setName(request.getName());
        if (request.getRank() != null) crew.setRank(request.getRank());
        if (request.getBase() != null) crew.setBase(request.getBase());
        if (request.getLanguage() != null) crew.setLanguage(request.getLanguage());
        if (request.getStatus() != null) crew.setStatus(request.getStatus());

        crewMemberMapper.updateById(crew);
        return crew;
    }

    @CacheEvict(value = "crew", key = "#id")
    public void delete(Long id) {
        CrewMember crew = getById(id);
        if ("ON_DUTY".equals(crew.getStatus())) {
            throw new BusinessException(ErrorCode.CREW_IN_DUTY);
        }
        crewMemberMapper.deleteById(id);
    }

    public boolean isAvailableForAssignment(Long crewId) {
        CrewMember crew = getById(crewId);
        return "AVAILABLE".equals(crew.getStatus());
    }
}
