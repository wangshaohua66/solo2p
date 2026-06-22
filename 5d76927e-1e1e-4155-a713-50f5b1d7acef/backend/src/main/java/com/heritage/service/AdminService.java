package com.heritage.service;

import com.heritage.entity.Booking;
import com.heritage.entity.Heritage;
import com.heritage.entity.Inheritor;
import com.heritage.enums.BookingStatus;
import com.heritage.repository.BookingRepository;
import com.heritage.repository.HeritageRepository;
import com.heritage.repository.InheritorRepository;
import com.heritage.repository.TrainingPlanRepository;
import com.heritage.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.GroupOperation;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminService {

    @Autowired
    private HeritageRepository heritageRepository;

    @Autowired
    private InheritorRepository inheritorRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TrainingPlanRepository trainingPlanRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();

        stats.put("totalHeritages", heritageRepository.count());
        stats.put("totalInheritors", inheritorRepository.count());
        stats.put("totalBookings", bookingRepository.count());
        stats.put("pendingBookings", bookingRepository.countByStatus(BookingStatus.PENDING));
        stats.put("approvedBookings", bookingRepository.countByStatus(BookingStatus.APPROVED));
        stats.put("totalUsers", userRepository.count());
        stats.put("totalTrainingPlans", trainingPlanRepository.count());

        stats.put("categoryStats", getCategoryStats());
        stats.put("monthlyBookings", getMonthlyBookings());
        stats.put("hotHeritages", heritageRepository.findTop10ByPublishedTrueOrderByHotScoreDesc());

        return stats;
    }

    public List<Map<String, Object>> getCategoryStats() {
        GroupOperation groupByCategory = Aggregation.group("category")
                .count().as("count");

        Aggregation aggregation = Aggregation.newAggregation(groupByCategory);

        return mongoTemplate.aggregate(aggregation, "heritages", Map.class).getMappedResults();
    }

    public List<Map<String, Object>> getMonthlyBookings() {
        List<Map<String, Object>> result = new ArrayList<>();
        YearMonth currentMonth = YearMonth.now();

        for (int i = 5; i >= 0; i--) {
            YearMonth month = currentMonth.minusMonths(i);
            LocalDate start = month.atDay(1);
            LocalDate end = month.atEndOfMonth();

            LocalDateTime startDateTime = start.atStartOfDay();
            LocalDateTime endDateTime = end.atTime(23, 59, 59);

            List<Booking> bookings = bookingRepository.findByCreatedAtBetween(startDateTime, endDateTime);

            Map<String, Object> monthData = new HashMap<>();
            monthData.put("month", month.toString());
            monthData.put("count", bookings.size());
            result.add(monthData);
        }

        return result;
    }

    public Map<String, Object> generateMonthlyReport(String yearMonth) {
        Map<String, Object> report = new HashMap<>();

        YearMonth ym = YearMonth.parse(yearMonth);
        LocalDateTime start = ym.atDay(1).atStartOfDay();
        LocalDateTime end = ym.atEndOfMonth().atTime(23, 59, 59);

        List<Booking> monthlyBookings = bookingRepository.findByCreatedAtBetween(start, end);

        report.put("period", yearMonth);
        report.put("totalBookings", monthlyBookings.size());
        report.put("approvedBookings",
                monthlyBookings.stream().filter(b -> b.getStatus() == BookingStatus.APPROVED).count());
        report.put("rejectedBookings",
                monthlyBookings.stream().filter(b -> b.getStatus() == BookingStatus.REJECTED).count());
        report.put("newHeritages", heritageRepository.findAll().stream()
                .filter(h -> h.getCreatedAt() != null
                        && h.getCreatedAt().isAfter(start)
                        && h.getCreatedAt().isBefore(end))
                .count());
        report.put("totalViews", heritageRepository.findAll().stream()
                .mapToLong(Heritage::getViewCount).sum());
        report.put("averageInheritorAge", inheritorRepository.findAll().stream()
                .mapToInt(Inheritor::getAge)
                .average()
                .orElse(0.0));

        return report;
    }
}
