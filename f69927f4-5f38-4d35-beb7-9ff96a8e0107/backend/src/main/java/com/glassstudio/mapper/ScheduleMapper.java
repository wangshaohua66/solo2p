package com.glassstudio.mapper;

import com.glassstudio.dto.ScheduleCreateDTO;
import com.glassstudio.dto.ScheduleUpdateDTO;
import com.glassstudio.entity.Schedule;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface ScheduleMapper {

    Schedule toEntity(ScheduleCreateDTO dto);

    void updateEntity(ScheduleUpdateDTO dto, @MappingTarget Schedule entity);
}
