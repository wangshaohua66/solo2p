package com.glassstudio.mapper;

import com.glassstudio.dto.ScheduleCreateDTO;
import com.glassstudio.dto.ScheduleUpdateDTO;
import com.glassstudio.entity.Schedule;
import java.time.LocalDateTime;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T14:46:34+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class ScheduleMapperImpl implements ScheduleMapper {

    @Override
    public Schedule toEntity(ScheduleCreateDTO dto) {
        if ( dto == null ) {
            return null;
        }

        Schedule.ScheduleBuilder schedule = Schedule.builder();

        schedule.curveId( dto.getCurveId() );
        if ( dto.getEndTime() != null ) {
            schedule.endTime( LocalDateTime.parse( dto.getEndTime() ) );
        }
        schedule.kilnId( dto.getKilnId() );
        schedule.memberId( dto.getMemberId() );
        schedule.note( dto.getNote() );
        if ( dto.getStartTime() != null ) {
            schedule.startTime( LocalDateTime.parse( dto.getStartTime() ) );
        }
        schedule.workpieceCount( dto.getWorkpieceCount() );

        return schedule.build();
    }

    @Override
    public void updateEntity(ScheduleUpdateDTO dto, Schedule entity) {
        if ( dto == null ) {
            return;
        }

        if ( dto.getEndTime() != null ) {
            entity.setEndTime( LocalDateTime.parse( dto.getEndTime() ) );
        }
        if ( dto.getNote() != null ) {
            entity.setNote( dto.getNote() );
        }
        if ( dto.getStartTime() != null ) {
            entity.setStartTime( LocalDateTime.parse( dto.getStartTime() ) );
        }
        if ( dto.getStatus() != null ) {
            entity.setStatus( dto.getStatus() );
        }
        if ( dto.getWorkpieceCount() != null ) {
            entity.setWorkpieceCount( dto.getWorkpieceCount() );
        }
    }
}
