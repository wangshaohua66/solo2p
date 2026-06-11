package com.glassstudio.mapper;

import com.glassstudio.dto.MemberCreateDTO;
import com.glassstudio.dto.MemberUpdateDTO;
import com.glassstudio.entity.Member;
import org.mapstruct.Mapper;
import org.mapstruct.MappingTarget;
import org.mapstruct.NullValuePropertyMappingStrategy;

@Mapper(componentModel = "spring", nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface MemberMapper {

    Member toEntity(MemberCreateDTO dto);

    void updateEntity(MemberUpdateDTO dto, @MappingTarget Member entity);
}
