package com.glassstudio.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final StringRedisTemplate stringRedisTemplate;
    private final RedisScript<Long> rateLimitScript;

    public boolean tryAcquire(String key, int limit, int windowSeconds) {
        String redisKey = "rate:limit:" + key;
        long now = System.currentTimeMillis();

        List<String> keys = Collections.singletonList(redisKey);
        Long result = stringRedisTemplate.execute(rateLimitScript, keys,
                String.valueOf(limit),
                String.valueOf(windowSeconds * 1000L),
                String.valueOf(now));

        return result != null && result == 1;
    }
}
