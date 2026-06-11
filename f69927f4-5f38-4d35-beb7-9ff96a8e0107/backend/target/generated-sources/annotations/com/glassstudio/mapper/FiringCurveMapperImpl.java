package com.glassstudio.mapper;

import com.glassstudio.dto.CurveCreateDTO;
import com.glassstudio.dto.CurveUpdateDTO;
import com.glassstudio.entity.FiringCurve;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T11:20:40+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class FiringCurveMapperImpl implements FiringCurveMapper {

    @Override
    public FiringCurve toEntity(CurveCreateDTO dto) {
        if ( dto == null ) {
            return null;
        }

        FiringCurve.FiringCurveBuilder firingCurve = FiringCurve.builder();

        firingCurve.isTemplate( dto.getIsTemplate() );
        firingCurve.name( dto.getName() );
        firingCurve.segments( dto.getSegments() );

        return firingCurve.build();
    }

    @Override
    public void updateEntity(CurveUpdateDTO dto, FiringCurve entity) {
        if ( dto == null ) {
            return;
        }

        if ( dto.getIsTemplate() != null ) {
            entity.setIsTemplate( dto.getIsTemplate() );
        }
        if ( dto.getName() != null ) {
            entity.setName( dto.getName() );
        }
        if ( dto.getSegments() != null ) {
            entity.setSegments( dto.getSegments() );
        }
    }
}
