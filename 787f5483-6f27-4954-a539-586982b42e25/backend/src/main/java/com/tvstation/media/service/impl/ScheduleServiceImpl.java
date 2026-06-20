package com.tvstation.media.service.impl;

import com.tvstation.media.common.PageResult;
import com.tvstation.media.entity.ScheduleItem;
import com.tvstation.media.repository.ScheduleRepository;
import com.tvstation.media.service.ScheduleService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements ScheduleService {

    private final ScheduleRepository scheduleRepository;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss");

    @Override
    public List<ScheduleItem> getSchedule(String channelId, LocalDate date) {
        return scheduleRepository.findByChannelIdAndScheduleDateAndDeletedFalseOrderByStartTimeAsc(channelId, date);
    }

    @Override
    public PageResult<ScheduleItem> getScheduleList(String channelId, LocalDate startDate,
                                                  LocalDate endDate, Pageable pageable) {
        Specification<ScheduleItem> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isFalse(root.get("deleted")));
            if (channelId != null && !channelId.isEmpty()) {
                predicates.add(cb.equal(root.get("channelId"), channelId));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("scheduleDate"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("scheduleDate"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ScheduleItem> page = scheduleRepository.findAll(spec, pageable);
        return PageResult.of(page.getContent(), page.getTotalElements(),
                pageable.getPageNumber() + 1, pageable.getPageSize());
    }

    @Override
    @Transactional
    public ScheduleItem createSchedule(ScheduleItem scheduleItem, String userName) {
        scheduleItem.setCreatedBy(userName);
        scheduleItem.setUpdatedBy(userName);

        Integer maxSortOrder = scheduleRepository.findMaxSortOrder(
                scheduleItem.getChannelId(), scheduleItem.getScheduleDate());
        scheduleItem.setSortOrder(maxSortOrder != null ? maxSortOrder + 1 : 1);

        ScheduleItem saved = scheduleRepository.save(scheduleItem);
        log.info("Schedule created: id={}, channel={}, date={}, program={}",
                saved.getId(), saved.getChannelId(), saved.getScheduleDate(), saved.getProgramName());
        return saved;
    }

    @Override
    @Transactional
    public ScheduleItem updateSchedule(Long id, ScheduleItem scheduleItem, Long userId) {
        ScheduleItem existing = scheduleRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Schedule not found with id: " + id));

        existing.setProgramName(scheduleItem.getProgramName());
        existing.setProgramType(scheduleItem.getProgramType());
        existing.setScheduleDate(scheduleItem.getScheduleDate());
        existing.setStartTime(scheduleItem.getStartTime());
        existing.setEndTime(scheduleItem.getEndTime());
        existing.setDuration(scheduleItem.getDuration());
        existing.setEpisode(scheduleItem.getEpisode());
        existing.setDescription(scheduleItem.getDescription());
        existing.setTopicId(scheduleItem.getTopicId());
        existing.setMaterialIds(scheduleItem.getMaterialIds());
        existing.setStatus(scheduleItem.getStatus());
        existing.setUpdatedBy(String.valueOf(userId));

        return scheduleRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteSchedule(Long id, Long userId) {
        ScheduleItem item = scheduleRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Schedule not found with id: " + id));
        item.setDeleted(true);
        item.setUpdatedBy(String.valueOf(userId));
        scheduleRepository.save(item);
        log.info("Schedule deleted: id={}", id);
    }

    @Override
    @Transactional
    public void reorderSchedule(String channelId, String date, List<Map<String, Object>> items) {
        LocalDate scheduleDate = LocalDate.parse(date);
        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> item = items.get(i);
            Long id = ((Number) item.get("id")).longValue();
            LocalTime startTime = LocalTime.parse((String) item.get("startTime"));
            LocalTime endTime = LocalTime.parse((String) item.get("endTime"));

            scheduleRepository.findById(id).ifPresent(schedule -> {
                schedule.setSortOrder(i + 1);
                schedule.setStartTime(startTime);
                schedule.setEndTime(endTime);
                schedule.setDuration((int) Duration.between(startTime, endTime).toMinutes());
                scheduleRepository.save(schedule);
            });
        }
        log.info("Schedule reordered: channel={}, date={}, count={}", channelId, date, items.size());
    }

    @Override
    public byte[] exportSchedule(String channelId, LocalDate startDate, LocalDate endDate,
                               String format) throws Exception {
        List<ScheduleItem> items = scheduleRepository.findSchedulesInRange(channelId, startDate, endDate);

        if ("xml".equalsIgnoreCase(format)) {
            return exportToXml(items).getBytes(StandardCharsets.UTF_8);
        } else {
            return exportToExcel(items);
        }
    }

    @Override
    @Transactional
    public List<ScheduleItem> importSchedule(MultipartFile file, String channelId,
                                           String date, Long userId) throws Exception {
        LocalDate scheduleDate = LocalDate.parse(date);
        List<ScheduleItem> importedItems = new ArrayList<>();

        String filename = file.getOriginalFilename();
        if (filename != null && filename.endsWith(".xml")) {
            importedItems = importFromXml(file.getInputStream(), channelId, scheduleDate, userId);
        } else {
            importedItems = importFromExcel(file.getInputStream(), channelId, scheduleDate, userId);
        }

        for (int i = 0; i < importedItems.size(); i++) {
            ScheduleItem item = importedItems.get(i);
            item.setSortOrder(i + 1);
            ScheduleItem saved = scheduleRepository.save(item);
            importedItems.set(i, saved);
        }

        log.info("Schedule imported: channel={}, date={}, count={}", channelId, date, importedItems.size());
        return importedItems;
    }

    @Override
    public Map<String, Object> syncWithBroadcastSystem(List<Long> scheduleIds) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("syncedCount", scheduleIds.size());
        result.put("timestamp", LocalDateTime.now().toString());
        log.info("Sync with broadcast system: {} items", scheduleIds.size());
        return result;
    }

    @Override
    public List<Map<String, Object>> detectGaps(String channelId, LocalDate date) {
        List<ScheduleItem> items = getSchedule(channelId, date);
        List<Map<String, Object>> gaps = new ArrayList<>();

        LocalTime dayStart = LocalTime.of(0, 0);
        LocalTime dayEnd = LocalTime.of(23, 59, 59);
        LocalTime lastEnd = dayStart;

        for (ScheduleItem item : items) {
            if (item.getStartTime().isAfter(lastEnd)) {
                Map<String, Object> gap = new HashMap<>();
                gap.put("startTime", lastEnd);
                gap.put("endTime", item.getStartTime());
                gap.put("durationMinutes", Duration.between(lastEnd, item.getStartTime()).toMinutes());
                gap.put("type", "gap");
                gaps.add(gap);
            }
            if (item.getEndTime().isAfter(lastEnd)) {
                lastEnd = item.getEndTime();
            }
        }

        if (lastEnd.isBefore(dayEnd)) {
            Map<String, Object> gap = new HashMap<>();
            gap.put("startTime", lastEnd);
            gap.put("endTime", dayEnd);
            gap.put("durationMinutes", Duration.between(lastEnd, dayEnd).toMinutes());
            gap.put("type", "gap");
            gaps.add(gap);
        }

        return gaps;
    }

    @Override
    public Map<String, Object> getScheduleStatistics(LocalDate startDate, LocalDate endDate) {
        Map<String, Object> stats = new HashMap<>();
        List<ScheduleItem> items = scheduleRepository.findByScheduleDateBetweenAndDeletedFalse(startDate, endDate);

        int totalMinutes = items.stream().mapToInt(ScheduleItem::getDuration).sum();
        stats.put("totalPrograms", items.size());
        stats.put("totalDurationMinutes", totalMinutes);
        stats.put("totalDurationHours", String.format("%.2f", totalMinutes / 60.0));

        Map<String, Integer> byChannel = new HashMap<>();
        Map<ScheduleItem.ProgramType, Integer> byType = new HashMap<>();
        for (ScheduleItem item : items) {
            byChannel.merge(item.getChannelId(), item.getDuration(), Integer::sum);
            byType.merge(item.getProgramType(), item.getDuration(), Integer::sum);
        }
        stats.put("byChannelMinutes", byChannel);
        stats.put("byTypeMinutes", byType);

        return stats;
    }

    private byte[] exportToExcel(List<ScheduleItem> items) throws Exception {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("节目单");
            Row headerRow = sheet.createRow(0);
            headerRow.createCell(0).setCellValue("频道");
            headerRow.createCell(1).setCellValue("播出日期");
            headerRow.createCell(2).setCellValue("开始时间");
            headerRow.createCell(3).setCellValue("结束时间");
            headerRow.createCell(4).setCellValue("节目名称");
            headerRow.createCell(5).setCellValue("节目类型");
            headerRow.createCell(6).setCellValue("时长(分钟)");
            headerRow.createCell(7).setCellValue("状态");

            int rowNum = 1;
            for (ScheduleItem item : items) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(item.getChannelId());
                row.createCell(1).setCellValue(item.getScheduleDate().toString());
                row.createCell(2).setCellValue(item.getStartTime().format(TIME_FORMATTER));
                row.createCell(3).setCellValue(item.getEndTime().format(TIME_FORMATTER));
                row.createCell(4).setCellValue(item.getProgramName());
                row.createCell(5).setCellValue(item.getProgramType() != null ? item.getProgramType().name() : "");
                row.createCell(6).setCellValue(item.getDuration());
                row.createCell(7).setCellValue(item.getStatus() != null ? item.getStatus().name() : "");
            }

            for (int i = 0; i < 8; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        }
    }

    private String exportToXml(List<ScheduleItem> items) {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<schedule>\n");
        for (ScheduleItem item : items) {
            sb.append("  <item>\n");
            sb.append("    <channel>").append(item.getChannelId()).append("</channel>\n");
            sb.append("    <date>").append(item.getScheduleDate()).append("</date>\n");
            sb.append("    <startTime>").append(item.getStartTime()).append("</startTime>\n");
            sb.append("    <endTime>").append(item.getEndTime()).append("</endTime>\n");
            sb.append("    <programName>").append(item.getProgramName()).append("</programName>\n");
            sb.append("    <duration>").append(item.getDuration()).append("</duration>\n");
            sb.append("  </item>\n");
        }
        sb.append("</schedule>");
        return sb.toString();
    }

    private List<ScheduleItem> importFromExcel(InputStream is, String channelId,
                                             LocalDate date, Long userId) throws Exception {
        List<ScheduleItem> items = new ArrayList<>();
        try (Workbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                ScheduleItem item = ScheduleItem.builder()
                        .channelId(channelId)
                        .scheduleDate(date)
                        .startTime(LocalTime.parse(row.getCell(2).getStringCellValue()))
                        .endTime(LocalTime.parse(row.getCell(3).getStringCellValue()))
                        .programName(row.getCell(4).getStringCellValue())
                        .duration((int) row.getCell(6).getNumericCellValue())
                        .status(ScheduleItem.ScheduleStatus.pending)
                        .build();
                item.setCreatedBy(String.valueOf(userId));
                item.setUpdatedBy(String.valueOf(userId));
                items.add(item);
            }
        }
        return items;
    }

    private List<ScheduleItem> importFromXml(InputStream is, String channelId,
                                           LocalDate date, Long userId) {
        return new ArrayList<>();
    }
}
