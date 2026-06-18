package com.wedding.suite.repository;

import com.wedding.suite.entity.ScheduleTaskEntity;
import com.wedding.suite.enums.ResourceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleTaskRepository extends JpaRepository<ScheduleTaskEntity, Long> {

    List<ScheduleTaskEntity> findByResourceType(ResourceType resourceType);

    @Query("select t from ScheduleTaskEntity t where t.resourceType = :type and t.resourceId = :rid " +
           "and t.startTime < :end and t.endTime > :start")
    List<ScheduleTaskEntity> findConflicts(@Param("type") ResourceType type,
                                           @Param("rid") Long resourceId,
                                           @Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end);

    @Query("select t from ScheduleTaskEntity t where t.resourceType = :type " +
           "and t.resourceId in :ids and t.startTime < :end and t.endTime > :start")
    List<ScheduleTaskEntity> findConflictsByIds(@Param("type") ResourceType type,
                                                @Param("ids") List<Long> ids,
                                                @Param("start") LocalDateTime start,
                                                @Param("end") LocalDateTime end);

    List<ScheduleTaskEntity> findByWeddingId(Long weddingId);
    List<ScheduleTaskEntity> findByResourceTypeAndResourceId(ResourceType type, Long resourceId);

    @Query("select t from ScheduleTaskEntity t where t.resourceType = 'STAFF' and t.resourceId = :staffId " +
           "order by t.startTime asc")
    List<ScheduleTaskEntity> findStaffSchedule(@Param("staffId") Long staffId);
}
