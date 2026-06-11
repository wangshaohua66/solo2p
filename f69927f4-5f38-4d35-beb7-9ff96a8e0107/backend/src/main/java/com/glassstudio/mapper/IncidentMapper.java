package com.glassstudio.mapper;

import com.glassstudio.dto.IncidentCreateDTO;
import com.glassstudio.entity.Incident;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface IncidentMapper {

    Incident toEntity(IncidentCreateDTO dto);
}
