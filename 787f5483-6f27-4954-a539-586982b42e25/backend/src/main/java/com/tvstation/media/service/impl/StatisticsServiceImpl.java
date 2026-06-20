package com.tvstation.media.service.impl;

import com.tvstation.media.dto.WorkloadStatDTO;
import com.tvstation.media.entity.ReviewItem;
import com.tvstation.media.entity.User;
import com.tvstation.media.repository.MaterialRepository;
import com.tvstation.media.repository.ReviewRepository;
import com.tvstation.media.repository.TopicRepository;
import com.tvstation.media.repository.UserRepository;
import com.tvstation.media.service.StatisticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class StatisticsServiceImpl implements StatisticsService {

    private final TopicRepository topicRepository;
    private final MaterialRepository materialRepository;
    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;

    @Override
    public List<WorkloadStatDTO> getWorkloadStatistics(LocalDate startDate, LocalDate endDate,
                                                       String groupBy, String department, Long userId) {
        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.plusDays(1).atStartOfDay();
        String period = startDate.toString() + " ~ " + endDate.toString();

        Map<Long, WorkloadStatDTO> userStatsMap = new LinkedHashMap<>();

        for (Object[] row : topicRepository.aggregateByCreator(startDateTime, endDateTime, userId)) {
            Long creatorId = (Long) row[0];
            String creatorName = (String) row[1];
            Long topicCount = (Long) row[2];
            Long duration = row[3] != null ? ((Number) row[3]).longValue() : 0L;
            WorkloadStatDTO dto = userStatsMap.computeIfAbsent(creatorId,
                    k -> newWorkloadStat(creatorId, creatorName, period));
            dto.setTopicCount(topicCount);
            dto.setProgramDuration(duration);
        }

        for (Object[] row : materialRepository.aggregateByUploader(startDateTime, endDateTime, userId)) {
            Long uploaderId = (Long) row[0];
            String uploaderName = (String) row[1];
            Long materialCount = (Long) row[2];
            WorkloadStatDTO dto = userStatsMap.computeIfAbsent(uploaderId,
                    k -> newWorkloadStat(uploaderId, uploaderName, period));
            dto.setMaterialCount(materialCount);
        }

        for (Object[] row : reviewRepository.aggregateBySubmitter(startDateTime, endDateTime, userId)) {
            Long submitterId = (Long) row[0];
            String submitterName = (String) row[1];
            Long reviewCount = (Long) row[2];
            WorkloadStatDTO dto = userStatsMap.computeIfAbsent(submitterId,
                    k -> newWorkloadStat(submitterId, submitterName, period));
            dto.setReviewCount(reviewCount);
        }

        Map<Long, String> userDepartmentMap = buildUserDepartmentMap();
        for (WorkloadStatDTO dto : userStatsMap.values()) {
            dto.setDepartment(userDepartmentMap.get(dto.getUserId()));
        }

        List<WorkloadStatDTO> userStats = new ArrayList<>(userStatsMap.values());

        if (department != null && !department.trim().isEmpty()) {
            userStats = userStats.stream()
                    .filter(s -> department.equals(s.getDepartment()))
                    .collect(Collectors.toList());
        }

        if ("department".equalsIgnoreCase(groupBy)) {
            return aggregateByDepartment(userStats, period);
        }

        log.info("工作量统计查询完成: period={}, groupBy={}, userId={}, 结果数={}",
                period, groupBy, userId, userStats.size());
        return userStats;
    }

    @Override
    public Map<String, Object> getProductionStatistics(LocalDate startDate, LocalDate endDate) {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("topicsByProgramType", topicRepository.countByProgramType());
        stats.put("topicsByChannel", topicRepository.countByChannel());
        stats.put("materialsByType", materialRepository.countByType());
        Long totalMaterialSize = materialRepository.sumTotalFileSize();
        stats.put("totalMaterialSize", totalMaterialSize != null ? totalMaterialSize : 0L);
        stats.put("reviewsByType", reviewRepository.countByType());

        LocalDateTime[] range = toRange(startDate, endDate);
        if (range != null) {
            stats.put("topicCountInRange", topicRepository.countByDateRange(range[0], range[1]));
            stats.put("materialCountInRange", materialRepository.countByDateRange(range[0], range[1]));
        }

        log.info("生产统计查询完成: startDate={}, endDate={}", startDate, endDate);
        return stats;
    }

    @Override
    public Map<String, Object> getEfficiencyStatistics(LocalDate startDate, LocalDate endDate) {
        Map<String, Object> stats = new LinkedHashMap<>();
        long totalReviews = reviewRepository.countByDeletedFalse();
        long approved = reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.approved);
        long rejected = reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.rejected);
        long pending = reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.pending);
        long reviewing = reviewRepository.countByStatusAndDeletedFalse(ReviewItem.ReviewStatus.reviewing);

        stats.put("totalReviews", totalReviews);
        stats.put("approvedReviews", approved);
        stats.put("rejectedReviews", rejected);
        stats.put("pendingReviews", pending);
        stats.put("reviewingReviews", reviewing);
        stats.put("reviewPassRate", totalReviews > 0 ? (double) approved / totalReviews : 0.0);
        stats.put("reviewRejectRate", totalReviews > 0 ? (double) rejected / totalReviews : 0.0);
        stats.put("reviewsByStatus", reviewRepository.countByStatus());

        Double avgReviewTime = reviewRepository.calculateAvgReviewTime();
        stats.put("avgReviewTimeHours", avgReviewTime != null ? avgReviewTime : 0.0);

        LocalDateTime[] range = toRange(startDate, endDate);
        if (range != null) {
            stats.put("topicCountInRange", topicRepository.countByDateRange(range[0], range[1]));
        }

        log.info("效率统计查询完成: startDate={}, endDate={}", startDate, endDate);
        return stats;
    }

    private WorkloadStatDTO newWorkloadStat(Long userId, String userName, String period) {
        return WorkloadStatDTO.builder()
                .userId(userId)
                .userName(userName)
                .topicCount(0L)
                .materialCount(0L)
                .programDuration(0L)
                .reviewCount(0L)
                .period(period)
                .build();
    }

    private Map<Long, String> buildUserDepartmentMap() {
        Map<Long, String> map = new HashMap<>();
        for (User user : userRepository.findByDeletedFalse()) {
            map.put(user.getId(), user.getDepartment());
        }
        return map;
    }

    private List<WorkloadStatDTO> aggregateByDepartment(List<WorkloadStatDTO> userStats, String period) {
        Map<String, WorkloadStatDTO> deptMap = new LinkedHashMap<>();
        for (WorkloadStatDTO s : userStats) {
            String dept = s.getDepartment();
            if (dept == null || dept.isEmpty()) {
                dept = "未分配";
            }
            WorkloadStatDTO agg = deptMap.computeIfAbsent(dept, k -> WorkloadStatDTO.builder()
                    .department(k)
                    .topicCount(0L)
                    .materialCount(0L)
                    .programDuration(0L)
                    .reviewCount(0L)
                    .period(period)
                    .build());
            agg.setTopicCount(agg.getTopicCount() + s.getTopicCount());
            agg.setMaterialCount(agg.getMaterialCount() + s.getMaterialCount());
            agg.setProgramDuration(agg.getProgramDuration() + s.getProgramDuration());
            agg.setReviewCount(agg.getReviewCount() + s.getReviewCount());
        }
        List<WorkloadStatDTO> result = new ArrayList<>(deptMap.values());
        log.info("工作量统计按部门聚合完成: 部门数={}", result.size());
        return result;
    }

    private LocalDateTime[] toRange(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null) {
            return null;
        }
        return new LocalDateTime[]{startDate.atStartOfDay(), endDate.plusDays(1).atStartOfDay()};
    }
}
