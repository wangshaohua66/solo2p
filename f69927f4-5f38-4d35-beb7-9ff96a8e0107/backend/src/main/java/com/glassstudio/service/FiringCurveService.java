package com.glassstudio.service;

import com.glassstudio.dto.CurveCreateDTO;
import com.glassstudio.dto.CurveUpdateDTO;
import com.glassstudio.entity.CurveSegment;
import com.glassstudio.entity.FiringCurve;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.exception.ValidationException;
import com.glassstudio.mapper.FiringCurveMapper;
import com.glassstudio.repository.FiringCurveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FiringCurveService {

    private final FiringCurveRepository firingCurveRepository;
    private final FiringCurveMapper firingCurveMapper;

    private static final int MIN_TEMP = 20;
    private static final int MAX_TEMP = 1400;
    private static final double MAX_SLOPE_PER_MINUTE = 20.0;

    public Page<FiringCurve> getAllCurves(String keyword, Boolean isTemplate, Pageable pageable) {
        boolean hasKeyword = StringUtils.hasText(keyword);
        boolean hasIsTemplate = isTemplate != null;

        if (hasKeyword && hasIsTemplate) {
            return firingCurveRepository.findByNameContainingAndIsTemplate(keyword, isTemplate, pageable);
        } else if (hasKeyword) {
            return firingCurveRepository.findByNameContaining(keyword, pageable);
        } else if (hasIsTemplate) {
            return firingCurveRepository.findByIsTemplate(isTemplate, pageable);
        } else {
            return firingCurveRepository.findAll(pageable);
        }
    }

    public FiringCurve getCurveById(Long id) {
        return firingCurveRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("烧制曲线不存在"));
    }

    @Transactional
    public FiringCurve createCurve(CurveCreateDTO dto, Long createdBy) {
        validateSegments(dto.getSegments());

        FiringCurve curve = firingCurveMapper.toEntity(dto);
        curve.setCreatedBy(createdBy);
        if (curve.getIsTemplate() == null) {
            curve.setIsTemplate(false);
        }

        return firingCurveRepository.save(curve);
    }

    @Transactional
    public FiringCurve updateCurve(Long id, CurveUpdateDTO dto) {
        FiringCurve curve = getCurveById(id);

        if (dto.getSegments() != null) {
            validateSegments(dto.getSegments());
        }

        firingCurveMapper.updateEntity(dto, curve);
        return firingCurveRepository.save(curve);
    }

    @Transactional
    public void deleteCurve(Long id) {
        if (!firingCurveRepository.existsById(id)) {
            throw new NotFoundException("烧制曲线不存在");
        }
        firingCurveRepository.deleteById(id);
    }

    @Transactional
    public FiringCurve duplicateCurve(Long id, Long createdBy) {
        return duplicateCurve(id, createdBy, null);
    }

    @Transactional
    public FiringCurve duplicateCurve(Long id, Long createdBy, String newName) {
        FiringCurve original = getCurveById(id);

        List<CurveSegment> copiedSegments = new ArrayList<>();
        for (CurveSegment segment : original.getSegments()) {
            copiedSegments.add(CurveSegment.builder()
                    .targetTemp(segment.getTargetTemp())
                    .duration(segment.getDuration())
                    .description(segment.getDescription())
                    .build());
        }

        String name = (newName != null && !newName.isEmpty()) ? newName : original.getName() + " (副本)";

        FiringCurve duplicated = FiringCurve.builder()
                .name(name)
                .segments(copiedSegments)
                .isTemplate(false)
                .createdBy(createdBy)
                .build();

        return firingCurveRepository.save(duplicated);
    }

    public List<FiringCurve> getTemplates() {
        return firingCurveRepository.findByIsTemplateTrue();
    }

    public void validateSegments(List<CurveSegment> segments) {
        if (segments == null || segments.isEmpty()) {
            throw new ValidationException("曲线段不能为空");
        }

        int prevTemp = MIN_TEMP;
        for (int i = 0; i < segments.size(); i++) {
            CurveSegment segment = segments.get(i);

            if (segment.getTargetTemp() == null) {
                throw new ValidationException("第 " + (i + 1) + " 段的目标温度不能为空");
            }
            if (segment.getTargetTemp() < MIN_TEMP || segment.getTargetTemp() > MAX_TEMP) {
                throw new ValidationException("第 " + (i + 1) + " 段的目标温度必须在 " + MIN_TEMP + " 到 " + MAX_TEMP + " 之间");
            }
            if (segment.getDuration() == null || segment.getDuration() <= 0) {
                throw new ValidationException("第 " + (i + 1) + " 段的持续时间必须大于0");
            }

            int tempDiff = segment.getTargetTemp() - prevTemp;
            if (tempDiff > 0) {
                double slope = (double) tempDiff / segment.getDuration();
                if (slope > MAX_SLOPE_PER_MINUTE) {
                    throw new ValidationException("第 " + (i + 1) + " 段的升温速率过快，不能超过 " + MAX_SLOPE_PER_MINUTE + " 度/分钟");
                }
            }

            prevTemp = segment.getTargetTemp();
        }
    }
}
