package com.talentmarket.gateway.service;

import cn.hutool.core.util.StrUtil;
import cn.hutool.json.JSONUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class CrossCenterDataService {

    private final StringRedisTemplate stringRedisTemplate;
    private final WebClient.Builder webClientBuilder;

    private static final String DATA_SYNC_CHANNEL = "talent-market:data-sync";
    private static final String CENTER_REGISTRY_KEY = "talent-market:centers";
    private static final String DATA_CACHE_PREFIX = "talent-market:data:";
    private static final int CACHE_DEFAULT_SECONDS = 300;

    private final Map<String, CenterInfo> registeredCenters = new ConcurrentHashMap<>();

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class CenterInfo {
        private String centerId;
        private String centerName;
        private String region;
        private String baseUrl;
        private LocalDateTime registerTime;
        private LocalDateTime lastHeartbeat;
        private boolean active;
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class DataSyncMessage {
        private String syncId;
        private String sourceCenterId;
        private String targetCenterId;
        private SyncType syncType;
        private String dataType;
        private String dataId;
        private String dataJson;
        private OperationType operation;
        private LocalDateTime timestamp;
        private int version;
    }

    public enum SyncType {
        FULL, INCREMENTAL, SINGLE
    }

    public enum OperationType {
        CREATE, UPDATE, DELETE, REFRESH
    }

    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    public static class AggregatedData {
        private String dataType;
        private int totalCount;
        private List<Map<String, Object>> records;
        private Map<String, Integer> centerDistribution;
        private LocalDateTime aggregatedAt;
        private long tookMs;
    }

    public void registerCenter(CenterInfo centerInfo) {
        centerInfo.setRegisterTime(LocalDateTime.now());
        centerInfo.setLastHeartbeat(LocalDateTime.now());
        centerInfo.setActive(true);

        registeredCenters.put(centerInfo.getCenterId(), centerInfo);

        String key = CENTER_REGISTRY_KEY + ":" + centerInfo.getCenterId();
        stringRedisTemplate.opsForValue().set(
                key,
                JSONUtil.toJsonStr(centerInfo),
                5, TimeUnit.MINUTES
        );

        stringRedisTemplate.opsForSet().add(CENTER_REGISTRY_KEY, centerInfo.getCenterId());

        log.info("人才中心注册成功: {} - {} (URL: {})",
                centerInfo.getCenterId(), centerInfo.getCenterName(), centerInfo.getBaseUrl());
    }

    public void heartbeat(String centerId) {
        CenterInfo center = registeredCenters.get(centerId);
        if (center != null) {
            center.setLastHeartbeat(LocalDateTime.now());
            center.setActive(true);

            String key = CENTER_REGISTRY_KEY + ":" + centerId;
            String json = stringRedisTemplate.opsForValue().get(key);
            if (StrUtil.isNotBlank(json)) {
                try {
                    CenterInfo cached = JSONUtil.toBean(json, CenterInfo.class);
                    cached.setLastHeartbeat(LocalDateTime.now());
                    cached.setActive(true);
                    stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(cached), 5, TimeUnit.MINUTES);
                } catch (Exception e) {
                    log.warn("更新心跳缓存异常", e);
                }
            }
        }
    }

    public List<CenterInfo> getAllActiveCenters() {
        Set<String> centerIds = stringRedisTemplate.opsForSet().members(CENTER_REGISTRY_KEY);
        List<CenterInfo> centers = new ArrayList<>();

        if (centerIds != null) {
            for (String centerId : centerIds) {
                String key = CENTER_REGISTRY_KEY + ":" + centerId;
                String json = stringRedisTemplate.opsForValue().get(key);
                if (StrUtil.isNotBlank(json)) {
                    try {
                        CenterInfo info = JSONUtil.toBean(json, CenterInfo.class);
                        if (info.isActive() && info.getLastHeartbeat() != null
                                && Duration.between(info.getLastHeartbeat(), LocalDateTime.now()).toMinutes() < 10) {
                            centers.add(info);
                        } else {
                            registeredCenters.remove(centerId);
                            stringRedisTemplate.opsForSet().remove(CENTER_REGISTRY_KEY, centerId);
                        }
                    } catch (Exception e) {
                        log.warn("解析中心信息异常: {}", centerId, e);
                    }
                }
            }
        }

        registeredCenters.values().forEach(local -> {
            if (centers.stream().noneMatch(c -> c.getCenterId().equals(local.getCenterId()))) {
                if (local.isActive() && local.getLastHeartbeat() != null
                        && Duration.between(local.getLastHeartbeat(), LocalDateTime.now()).toMinutes() < 10) {
                    centers.add(local);
                }
            }
        });

        return centers;
    }

    public void publishDataSync(DataSyncMessage message) {
        message.setSyncId(UUID.randomUUID().toString());
        message.setTimestamp(LocalDateTime.now());
        if (message.getVersion() == 0) {
            message.setVersion(1);
        }

        String jsonMessage = JSONUtil.toJsonStr(message);
        stringRedisTemplate.convertAndSend(DATA_SYNC_CHANNEL, jsonMessage);

        if (StrUtil.isNotBlank(message.getDataJson()) && message.getDataType() != null) {
            String cacheKey = DATA_CACHE_PREFIX + message.getDataType() + ":" + message.getDataId();
            stringRedisTemplate.opsForValue().set(cacheKey, message.getDataJson(), CACHE_DEFAULT_SECONDS, TimeUnit.SECONDS);
        }

        log.info("发布数据同步消息: type={}, dataType={}, dataId={}, op={}",
                message.getSyncType(), message.getDataType(), message.getDataId(), message.getOperation());
    }

    public <T> T getCachedData(String dataType, String dataId, Class<T> clazz) {
        String cacheKey = DATA_CACHE_PREFIX + dataType + ":" + dataId;
        String json = stringRedisTemplate.opsForValue().get(cacheKey);
        if (StrUtil.isNotBlank(json)) {
            try {
                return JSONUtil.toBean(json, clazz);
            } catch (Exception e) {
                log.warn("解析缓存数据异常: {}", cacheKey, e);
            }
        }
        return null;
    }

    public void setCachedData(String dataType, String dataId, Object data, int ttlSeconds) {
        String cacheKey = DATA_CACHE_PREFIX + dataType + ":" + dataId;
        stringRedisTemplate.opsForValue().set(
                cacheKey,
                JSONUtil.toJsonStr(data),
                ttlSeconds > 0 ? ttlSeconds : CACHE_DEFAULT_SECONDS,
                TimeUnit.SECONDS
        );
    }

    public Mono<AggregatedData> fetchCrossCenterData(String dataType, Map<String, String> queryParams) {
        long startMs = System.currentTimeMillis();
        List<CenterInfo> centers = getAllActiveCenters();
        Map<String, Integer> distribution = new HashMap<>();
        List<Map<String, Object>> allRecords = Collections.synchronizedList(new ArrayList<>());

        if (centers.isEmpty()) {
            log.warn("没有活动的人才中心可聚合");
            return Mono.just(AggregatedData.builder()
                    .dataType(dataType)
                    .totalCount(0)
                    .records(Collections.emptyList())
                    .centerDistribution(distribution)
                    .aggregatedAt(LocalDateTime.now())
                    .tookMs(System.currentTimeMillis() - startMs)
                    .build());
        }

        String path = buildApiPath(dataType, queryParams);
        log.info("开始跨中心聚合查询: dataType={}, path={}, centers={}", dataType, path, centers.size());

        List<Mono<List<Map<String, Object>>>> fetchMonos = centers.stream()
                .map(center -> fetchFromCenter(center, path, dataType, distribution, allRecords))
                .toList();

        return Flux.concat(fetchMonos)
                .then(Mono.fromCallable(() -> {
                    log.info("跨中心聚合完成: dataType={}, total={}, centers={}, took={}ms",
                            dataType, allRecords.size(), distribution, System.currentTimeMillis() - startMs);
                    return AggregatedData.builder()
                            .dataType(dataType)
                            .totalCount(allRecords.size())
                            .records(new ArrayList<>(allRecords))
                            .centerDistribution(distribution)
                            .aggregatedAt(LocalDateTime.now())
                            .tookMs(System.currentTimeMillis() - startMs)
                            .build();
                }));
    }

    private Mono<List<Map<String, Object>>> fetchFromCenter(
            CenterInfo center, String path, String dataType,
            Map<String, Integer> distribution, List<Map<String, Object>> allRecords) {

        WebClient webClient = webClientBuilder
                .clone()
                .baseUrl(center.getBaseUrl())
                .build();

        return webClient.get()
                .uri(path)
                .retrieve()
                .bodyToMono(String.class)
                .map(json -> {
                    List<Map<String, Object>> parsed = parseResponse(json);
                    log.debug("从中心 {} 获取 {} 条 {} 数据", center.getCenterName(), parsed.size(), dataType);
                    distribution.put(center.getCenterId(), parsed.size());

                    parsed.forEach(record -> {
                        record.put("_centerId", center.getCenterId());
                        record.put("_centerName", center.getCenterName());
                        record.put("_region", center.getRegion());
                        allRecords.add(record);
                    });

                    return parsed;
                })
                .onErrorResume(e -> {
                    log.error("从中心 {} 获取数据失败: {}", center.getCenterName(), e.getMessage());
                    distribution.put(center.getCenterId(), -1);
                    return Mono.just(Collections.emptyList());
                })
                .timeout(Duration.ofSeconds(8))
                .onErrorResume(e -> {
                    log.warn("中心 {} 超时", center.getCenterName());
                    return Mono.just(Collections.emptyList());
                });
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseResponse(String json) {
        if (StrUtil.isBlank(json)) {
            return Collections.emptyList();
        }
        try {
            cn.hutool.json.JSONObject obj = JSONUtil.parseObj(json);
            Object data = obj.get("data");
            if (data instanceof cn.hutool.json.JSONArray arr) {
                return arr.toList(Map.class);
            } else if (data instanceof cn.hutool.json.JSONObject innerObj) {
                Object records = innerObj.get("records");
                if (records instanceof cn.hutool.json.JSONArray arr) {
                    return arr.toList(Map.class);
                } else if (records instanceof List list) {
                    return (List<Map<String, Object>>) list;
                }
                return List.of(innerObj.toBean(Map.class));
            } else if (data instanceof List list) {
                return (List<Map<String, Object>>) list;
            }
            if (obj.containsKey("records")) {
                Object records = obj.get("records");
                if (records instanceof cn.hutool.json.JSONArray arr) {
                    return arr.toList(Map.class);
                }
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.warn("解析响应异常", e);
            return Collections.emptyList();
        }
    }

    private String buildApiPath(String dataType, Map<String, String> queryParams) {
        String path = switch (dataType.toLowerCase()) {
            case "jobs", "job", "positions", "position" -> "/api/recruitment/jobs/public";
            case "enterprises", "enterprise" -> "/api/enterprise/list/public";
            case "resumes", "resume" -> "/api/jobseeker/resumes/public";
            case "fairs", "fair", "recruitment-fairs" -> "/api/recruitment/fairs/public";
            case "statistics", "stats" -> "/api/statistics/overview";
            default -> "/api/" + dataType + "/public";
        };

        if (queryParams != null && !queryParams.isEmpty()) {
            StringBuilder sb = new StringBuilder(path);
            boolean first = !path.contains("?");
            for (Map.Entry<String, String> entry : queryParams.entrySet()) {
                sb.append(first ? "?" : "&");
                first = false;
                sb.append(entry.getKey()).append("=")
                        .append(StrUtil.urlEncode(entry.getValue(), "UTF-8"));
            }
            path = sb.toString();
        }
        return path;
    }

    public void syncDataToOtherCenters(String sourceCenterId, String dataType, String dataId,
                                        Object data, OperationType operation) {
        List<CenterInfo> centers = getAllActiveCenters();

        DataSyncMessage message = DataSyncMessage.builder()
                .sourceCenterId(sourceCenterId)
                .syncType(SyncType.SINGLE)
                .dataType(dataType)
                .dataId(dataId)
                .dataJson(JSONUtil.toJsonStr(data))
                .operation(operation)
                .build();

        for (CenterInfo target : centers) {
            if (!target.getCenterId().equals(sourceCenterId)) {
                message.setTargetCenterId(target.getCenterId());
                publishDataSync(message);
            }
        }

        log.info("广播数据变更: source={}, dataType={}, dataId={}, op={}",
                sourceCenterId, dataType, dataId, operation);
    }

    public void broadcastEnterpriseVerifyResult(String centerId, Long enterpriseId,
                                                 boolean passed, String message) {
        Map<String, Object> event = new HashMap<>();
        event.put("centerId", centerId);
        event.put("enterpriseId", enterpriseId);
        event.put("passed", passed);
        event.put("message", message);
        event.put("timestamp", LocalDateTime.now().toString());

        syncDataToOtherCenters(centerId, "enterprise-verify",
                String.valueOf(enterpriseId), event, OperationType.UPDATE);
    }

    public void broadcastJobPublished(String centerId, Long jobId, Map<String, Object> jobData) {
        syncDataToOtherCenters(centerId, "job",
                String.valueOf(jobId), jobData, OperationType.CREATE);
    }

    public void broadcastFairUpdated(String centerId, Long fairId, Map<String, Object> fairData) {
        syncDataToOtherCenters(centerId, "recruitment-fair",
                String.valueOf(fairId), fairData, OperationType.UPDATE);
    }

    public Mono<String> getChannelName() {
        return Mono.just(DATA_SYNC_CHANNEL);
    }
}
