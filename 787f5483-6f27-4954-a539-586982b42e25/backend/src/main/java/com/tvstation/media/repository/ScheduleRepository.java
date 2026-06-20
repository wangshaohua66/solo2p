package com.tvstation.media.repository;

import com.tvstation.media.entity.ScheduleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduleRepository extends JpaRepository<ScheduleItem, Long>, JpaSpecificationExecutor<ScheduleItem> {

    List<ScheduleItem> findByChannelIdAndScheduleDateAndDeletedFalseOrderBySortOrder(
            ScheduleItem.Channel channelId,
            String scheduleDate);

    Optional<ScheduleItem> findByChannelIdAndStartTimeAndDeletedFalse(
            ScheduleItem.Channel channelId,
            LocalDateTime startTime);

    @Query("SELECT s FROM ScheduleItem s WHERE s.deleted = false AND " +
           "s.channelId = :channelId AND " +
           "s.scheduleDate >= :startDate AND s.scheduleDate <= :endDate " +
           "ORDER BY s.scheduleDate, s.sortOrder")
    List<ScheduleItem> findByDateRange(
            @Param("channelId") ScheduleItem.Channel channelId,
            @Param("startDate") String startDate,
            @Param("endDate") String endDate);

    @Query("SELECT COUNT(s) FROM ScheduleItem s WHERE s.deleted = false AND " +
           "s.channelId = :channelId AND s.scheduleDate = :scheduleDate")
    Long countByChannelAndDate(
            @Param("channelId") ScheduleItem.Channel channelId,
            @Param("scheduleDate") String scheduleDate);

    @Query("SELECT COALESCE(SUM(s.duration), 0) FROM ScheduleItem s WHERE s.deleted = false AND " +
           "s.channelId = :channelId AND s.scheduleDate = :scheduleDate")
    Integer sumDurationByChannelAndDate(
            @Param("channelId") ScheduleItem.Channel channelId,
            @Param("scheduleDate") String scheduleDate);

    @Modifying
    @Transactional
    @Query("UPDATE ScheduleItem s SET s.sortOrder = :sortOrder WHERE s.id = :id")
    void updateSortOrder(@Param("id") Long id, @Param("sortOrder") Integer sortOrder);

    @Query("SELECT s FROM ScheduleItem s WHERE s.deleted = false AND " +
           "s.status = 'scheduled' AND s.startTime BETWEEN :now AND :nearFuture " +
           "ORDER BY s.startTime")
    List<ScheduleItem> findUpcomingPrograms(
            @Param("now") LocalDateTime now,
            @Param("nearFuture") LocalDateTime nearFuture);

    List<ScheduleItem> findByTopicIdAndDeletedFalse(Long topicId);

    @Query("SELECT s.channelId, s.scheduleDate, SUM(s.duration) FROM ScheduleItem s " +
           "WHERE s.deleted = false AND s.scheduleDate BETWEEN :startDate AND :endDate " +
           "GROUP BY s.channelId, s.scheduleDate")
    List<Object[]> getStatsByDateRange(
            @Param("startDate") String startDate,
            @Param("endDate") String endDate);
}
