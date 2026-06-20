package com.tvstation.media.service;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ScheduleItem;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ScheduleService {

    List<ScheduleItem> getSchedule(String channelId, LocalDate date);

    PageResult<ScheduleItem> getScheduleList(String channelId, LocalDate startDate,
                                             LocalDate endDate, Pageable pageable);

    ScheduleItem createSchedule(ScheduleItem scheduleItem, String userName);

    ScheduleItem updateSchedule(Long id, ScheduleItem scheduleItem, Long userId);

    void deleteSchedule(Long id, Long userId);

    void reorderSchedule(String channelId, String date, List<Map<String, Object>> items);

    byte[] exportSchedule(String channelId, LocalDate startDate, LocalDate endDate, String format) throws Exception;

    List<ScheduleItem> importSchedule(MultipartFile file, String channelId, String date, Long userId) throws Exception;

    Map<String, Object> syncWithBroadcastSystem(List<Long> scheduleIds);

    List<Map<String, Object>> detectGaps(String channelId, LocalDate date);

    Map<String, Object> getScheduleStatistics(LocalDate startDate, LocalDate endDate);
}
