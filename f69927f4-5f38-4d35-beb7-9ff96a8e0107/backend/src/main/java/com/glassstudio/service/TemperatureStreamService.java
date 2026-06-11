package com.glassstudio.service;

import com.glassstudio.entity.CurveSegment;
import com.glassstudio.entity.FiringCurve;
import com.glassstudio.entity.TemperatureReading;
import com.glassstudio.repository.FiringCurveRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TemperatureStreamService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final FiringCurveRepository firingCurveRepository;

    private static final String STREAM_KEY_PREFIX = "temperature:stream:";
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final double DEFAULT_START_TEMP = 20.0;

    public void publishReading(Long kilnId, Double temperature) {
        String streamKey = STREAM_KEY_PREFIX + kilnId;
        LocalDateTime now = LocalDateTime.now();

        MapRecord<String, String, String> record = StreamRecords.string(Map.of(
                "kilnId", String.valueOf(kilnId),
                "temperature", String.valueOf(temperature),
                "timestamp", now.format(FORMATTER)
        )).withStreamKey(streamKey);

        redisTemplate.opsForStream().add(record);
    }

    public List<TemperatureReading> readLatestReadings(Long kilnId, int count) {
        String streamKey = STREAM_KEY_PREFIX + kilnId;

        List<MapRecord<String, Object, Object>> records = redisTemplate.opsForStream()
                .range(streamKey, Range.unbounded());

        List<TemperatureReading> readings = new ArrayList<>();
        if (records != null && !records.isEmpty()) {
            int start = Math.max(0, records.size() - count);
            for (int i = start; i < records.size(); i++) {
                readings.add(mapToReading(records.get(i)));
            }
        }
        return readings;
    }

    private TemperatureReading mapToReading(MapRecord<String, Object, Object> record) {
        Map<Object, Object> map = record.getValue();
        return TemperatureReading.builder()
                .kilnId(Long.valueOf(String.valueOf(map.get("kilnId"))))
                .temperature(Double.valueOf(String.valueOf(map.get("temperature"))))
                .timestamp(LocalDateTime.parse(String.valueOf(map.get("timestamp")), FORMATTER))
                .build();
    }

    @Async
    public void simulateFiring(Long kilnId, FiringCurve curve) {
        log.info("Starting temperature simulation for kiln {} with curve {}", kilnId, curve.getName());

        try {
            List<CurveSegment> segments = curve.getSegments();
            if (segments == null || segments.isEmpty()) {
                log.warn("No segments found in curve {}", curve.getId());
                return;
            }

            double currentTemp = DEFAULT_START_TEMP;
            for (CurveSegment segment : segments) {
                double targetTemp = segment.getTargetTemp().doubleValue();
                int durationMinutes = segment.getDuration();

                int steps = durationMinutes * 2;
                double tempStep = (targetTemp - currentTemp) / steps;
                long sleepMs = 500;

                for (int i = 0; i < steps; i++) {
                    publishReading(kilnId, currentTemp);
                    currentTemp += tempStep;
                    Thread.sleep(sleepMs);
                }
                currentTemp = targetTemp;
            }

            log.info("Temperature simulation completed for kiln {}", kilnId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Temperature simulation interrupted for kiln {}", kilnId);
        } catch (Exception e) {
            log.error("Error in temperature simulation for kiln {}", kilnId, e);
        }
    }

    @Async
    public void simulateFiring(Long kilnId, Long curveId) {
        FiringCurve curve = firingCurveRepository.findById(curveId)
                .orElseThrow(() -> new IllegalArgumentException("Curve not found: " + curveId));
        simulateFiring(kilnId, curve);
    }
}
