package com.notarization.model;

import com.notarization.model.enums.NotarizationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "statistics")
public class StatisticRecord {

    @Id
    private String id;

    @Indexed
    private PeriodType periodType;

    @Indexed
    private LocalDate startDate;

    @Indexed
    private LocalDate endDate;

    private Map<NotarizationType, Long> typeStats;

    private Double avgDurationHours;

    private Double supplementRate;

    private Map<String, Integer> notaryWorkload;

    private Double foreignRate;

    @Indexed
    private Instant createdAt;

    public enum PeriodType {
        DAILY,
        MONTHLY,
        QUARTERLY
    }
}
