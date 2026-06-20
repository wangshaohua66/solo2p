package com.mw.registration.service;

import com.mw.common.enums.WasteCategory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 追溯编码生成器：MW-{机构}-{类别}-{日期}-{6位序列}
 * 使用 Redis INCR 保证分布式唯一递增，Redis 不可用时降级为随机序列。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TraceCodeGenerator {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final StringRedisTemplate redisTemplate;

    public String generate(String orgId, WasteCategory category) {
        String org = orgId == null ? "0000" : orgId.length() > 4 ? orgId.substring(orgId.length() - 4) : orgId;
        String cat = category.name().substring(0, Math.min(3, category.name().length()));
        String date = LocalDate.now().format(DATE_FMT);
        String seq = nextSeq(orgId, category, date);
        return "MW-" + org + "-" + cat + "-" + date + "-" + seq;
    }

    private String nextSeq(String orgId, WasteCategory category, String date) {
        String key = "trace:seq:" + orgId + ":" + category + ":" + date;
        try {
            Long seq = redisTemplate.opsForValue().increment(key);
            if (seq != null) {
                redisTemplate.expireAt(key, LocalDate.now().plusDays(2)
                        .atStartOfDay(java.time.ZoneId.systemDefault()).toInstant());
            }
            return String.format("%06d", seq == null ? 0 : seq);
        } catch (Exception e) {
            log.warn("Redis自增失败，降级随机序列: {}", e.getMessage());
            return String.format("%06d", ThreadLocalRandom.current().nextInt(1, 999999));
        }
    }
}
