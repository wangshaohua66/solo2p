package com.crew.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.crew.common.BusinessException;
import com.crew.common.ErrorCode;
import com.crew.common.PageResult;
import com.crew.dto.QualificationCreateRequest;
import com.crew.entity.CrewMember;
import com.crew.entity.Qualification;
import com.crew.mapper.CrewMemberMapper;
import com.crew.mapper.QualificationMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class QualificationService {

    private final QualificationMapper qualificationMapper;
    private final CrewMemberMapper crewMemberMapper;

    public Qualification getById(Long id) {
        Qualification qual = qualificationMapper.selectById(id);
        if (qual == null) {
            throw new BusinessException(ErrorCode.QUAL_NOT_FOUND);
        }
        return qual;
    }

    public List<Qualification> listByCrewId(Long crewId) {
        return qualificationMapper.findByCrewId(crewId);
    }

    public PageResult<Qualification> list(Long crewId, String qualType, String status, int page, int size) {
        LambdaQueryWrapper<Qualification> wrapper = new LambdaQueryWrapper<>();
        if (crewId != null) wrapper.eq(Qualification::getCrewId, crewId);
        if (qualType != null) wrapper.eq(Qualification::getQualType, qualType);
        if (status != null) wrapper.eq(Qualification::getStatus, status);
        wrapper.orderByAsc(Qualification::getExpiryDate);

        IPage<Qualification> result = qualificationMapper.selectPage(new Page<>(page, size), wrapper);
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    @Transactional
    public Qualification create(QualificationCreateRequest request) {
        CrewMember crew = crewMemberMapper.selectById(request.getCrewId());
        if (crew == null) {
            throw new BusinessException(ErrorCode.CREW_NOT_FOUND);
        }

        Qualification qual = new Qualification();
        qual.setCrewId(request.getCrewId());
        qual.setQualType(request.getQualType());
        qual.setQualCode(request.getQualCode());
        qual.setAircraftType(request.getAircraftType());
        qual.setIssueDate(request.getIssueDate());
        qual.setExpiryDate(request.getExpiryDate());
        qual.setLanguageLevel(request.getLanguageLevel());
        qual.setRemark(request.getRemark());

        LocalDate today = LocalDate.now();
        if (request.getExpiryDate().isBefore(today)) {
            qual.setStatus("EXPIRED");
        } else if (request.getExpiryDate().isBefore(today.plusDays(30))) {
            qual.setStatus("EXPIRING_SOON");
        } else {
            qual.setStatus("VALID");
        }

        qualificationMapper.insert(qual);
        return qual;
    }

    @Transactional
    public Qualification update(Long id, QualificationCreateRequest request) {
        Qualification qual = getById(id);
        qual.setQualType(request.getQualType());
        qual.setQualCode(request.getQualCode());
        qual.setAircraftType(request.getAircraftType());
        qual.setIssueDate(request.getIssueDate());
        qual.setExpiryDate(request.getExpiryDate());
        qual.setLanguageLevel(request.getLanguageLevel());
        qual.setRemark(request.getRemark());

        LocalDate today = LocalDate.now();
        if (request.getExpiryDate().isBefore(today)) {
            qual.setStatus("EXPIRED");
        } else if (request.getExpiryDate().isBefore(today.plusDays(30))) {
            qual.setStatus("EXPIRING_SOON");
        } else {
            qual.setStatus("VALID");
        }

        qualificationMapper.updateById(qual);
        return qual;
    }

    public void delete(Long id) {
        qualificationMapper.deleteById(id);
    }

    public List<Qualification> findExpiringQualifications(int withinDays) {
        LocalDate today = LocalDate.now();
        LocalDate warningDate = today.plusDays(withinDays);
        return qualificationMapper.findExpiringBefore(today, warningDate);
    }

    @Transactional
    public void processExpiredQualifications() {
        LocalDate today = LocalDate.now();
        List<Qualification> expired = qualificationMapper.findExpired(today);

        for (Qualification qual : expired) {
            qual.setStatus("EXPIRED");
            qualificationMapper.updateById(qual);
            log.warn("资质已过期: crewId={}, qualType={}, expiryDate={}",
                    qual.getCrewId(), qual.getQualType(), qual.getExpiryDate());

            if ("TYPE_RATING".equals(qual.getQualType()) || "LICENSE".equals(qual.getQualType()) || "MEDICAL".equals(qual.getQualType())) {
                CrewMember crew = crewMemberMapper.selectById(qual.getCrewId());
                if (crew != null && "AVAILABLE".equals(crew.getStatus())) {
                    crew.setStatus("GROUNDED");
                    crewMemberMapper.updateById(crew);
                    log.warn("机组人员因资质过期被停飞: crewId={}, name={}", crew.getId(), crew.getName());
                }
            }
        }
    }

    public boolean hasValidTypeRating(Long crewId, String aircraftType) {
        List<Qualification> ratings = qualificationMapper.findTypeRating(crewId, aircraftType);
        return !ratings.isEmpty();
    }

    public boolean hasValidQualification(Long crewId, String qualType) {
        List<Qualification> quals = qualificationMapper.findValidByCrewAndType(crewId, qualType);
        return !quals.isEmpty();
    }

    public boolean isCrewQualified(Long crewId, String aircraftType, String languageRequired) {
        if (!hasValidTypeRating(crewId, aircraftType)) {
            return false;
        }
        if (!hasValidQualification(crewId, "LICENSE")) {
            return false;
        }
        if (!hasValidQualification(crewId, "MEDICAL")) {
            return false;
        }
        if (languageRequired != null && !languageRequired.isEmpty()) {
            if (!hasValidQualification(crewId, "LANGUAGE")) {
                return false;
            }
        }
        return true;
    }
}
