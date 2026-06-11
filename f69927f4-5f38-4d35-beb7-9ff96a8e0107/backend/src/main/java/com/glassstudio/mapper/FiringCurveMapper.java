package com.glassstudio.mapper;

import com.glassstudio.dto.CurveCreateDTO;
import com.glassstudio.dto.CurveUpdateDTO;
import com.glassstudio.entity.FiringCurve;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface FiringCurveMapper {

    FiringCurve toEntity(CurveCreateDTO dto);

    void updateEntity(CurveUpdateDTO dto, @MappingTarget FiringCurve entity);
}
