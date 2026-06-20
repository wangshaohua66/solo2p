package com.mw.tracking.service;

import cn.hutool.json.JSONUtil;
import com.mw.common.audit.AuditAction;
import com.mw.common.audit.Auditable;
import com.mw.common.enums.AlertType;
import com.mw.tracking.document.GpsPoint;
import com.mw.tracking.document.VehicleLocation;
import com.mw.tracking.dto.GpsBatchRequest;
import com.mw.tracking.dto.GpsIngestDTO;
import com.mw.tracking.repository.GpsPointRepository;
import com.mw.tracking.repository.VehicleLocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.BulkOperations;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class VehicleTrackingService {

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double DEVIATION_THRESHOLD_KM = 2.0;
    private static final String ALERT_EVENT_QUEUE = "queue:alert_events";
    private static final String POSITION_CACHE_PREFIX = "vehicle:pos:";

    private final GpsPointRepository gpsPointRepository;
    private final VehicleLocationRepository vehicleLocationRepository;
    private final MongoTemplate mongoTemplate;
    private final StringRedisTemplate redisTemplate;

    @Auditable(action = AuditAction.CREATE, module = "tracking", description = "单条GPS上报")
    public GpsPoint ingest(GpsIngestDTO dto) {
        GpsPoint point = toGpsPoint(dto);
        point.setDeviated(checkDeviation(dto));
        gpsPointRepository.save(point);
        updateLocation(dto, point.getDeviated());
        if (Boolean.TRUE.equals(point.getDeviated())) {
            publishDeviationEvent(dto);
        }
        return point;
    }

    @Auditable(action = AuditAction.UPLOAD, module = "tracking", description = "批量GPS上报")
    public int batchIngest(GpsBatchRequest request) {
        BulkOperations bulkOps = mongoTemplate.bulkOps(BulkOperations.BulkMode.UNORDERED, GpsPoint.class);
        for (GpsIngestDTO dto : request.getPoints()) {
            GpsPoint point = toGpsPoint(dto);
            point.setDeviated(checkDeviation(dto));
            bulkOps.insert(point);
            updateLocation(dto, point.getDeviated());
            if (Boolean.TRUE.equals(point.getDeviated())) {
                publishDeviationEvent(dto);
            }
        }
        bulkOps.execute();
        log.debug("批量GPS写入完成: 数量={}", request.getPoints().size());
        return request.getPoints().size();
    }

    public VehicleLocation getLatestPosition(String vehicleId) {
        String cacheKey = POSITION_CACHE_PREFIX + vehicleId;
        try {
            String json = redisTemplate.opsForValue().get(cacheKey);
            if (json != null) {
                return JSONUtil.toBean(json, VehicleLocation.class);
            }
        } catch (Exception e) {
            log.debug("读取位置缓存失败: {}", e.getMessage());
        }
        return vehicleLocationRepository.findByVehicleId(vehicleId).orElse(null);
    }

    public List<GpsPoint> historyTrack(String vehicleId, Long from, Long to) {
        Long start = from == null ? 0 : from;
        Long end = to == null ? System.currentTimeMillis() : to;
        return gpsPointRepository.findByVehicleIdAndTsBetweenOrderByTsAsc(vehicleId, start, end);
    }

    private GpsPoint toGpsPoint(GpsIngestDTO dto) {
        GpsPoint point = new GpsPoint();
        point.setVehicleId(dto.getVehicleId());
        point.setManifestNo(dto.getManifestNo());
        point.setLat(dto.getLat());
        point.setLng(dto.getLng());
        point.setSpeed(dto.getSpeed());
        point.setHeading(dto.getHeading());
        point.setTs(dto.getTs());
        return point;
    }

    private void updateLocation(GpsIngestDTO dto, Boolean deviated) {
        VehicleLocation loc = vehicleLocationRepository.findByVehicleId(dto.getVehicleId()).orElseGet(VehicleLocation::new);
        if (loc.getId() == null) {
            loc.setVehicleId(dto.getVehicleId());
        }
        loc.setLat(dto.getLat());
        loc.setLng(dto.getLng());
        loc.setLastTs(dto.getTs());
        loc.setDeviated(deviated);
        loc.setEtaMinutes(computeEta(loc, dto));
        vehicleLocationRepository.save(loc);
        try {
            redisTemplate.opsForValue().set(POSITION_CACHE_PREFIX + dto.getVehicleId(), JSONUtil.toJsonStr(loc));
        } catch (Exception e) {
            log.debug("写入位置缓存失败: {}", e.getMessage());
        }
    }

    private Integer computeEta(VehicleLocation loc, GpsIngestDTO dto) {
        if (loc == null || loc.getPlannedRoute() == null || loc.getPlannedRoute().isEmpty()
                || dto.getSpeed() == null || dto.getSpeed() <= 0) {
            return null;
        }
        double[] dest = loc.getPlannedRoute().get(loc.getPlannedRoute().size() - 1);
        double dist = haversine(dto.getLat(), dto.getLng(), dest[0], dest[1]);
        return (int) Math.round(dist / dto.getSpeed() * 60);
    }

    private Boolean checkDeviation(GpsIngestDTO dto) {
        VehicleLocation loc = vehicleLocationRepository.findByVehicleId(dto.getVehicleId()).orElse(null);
        if (loc == null || loc.getPlannedRoute() == null || loc.getPlannedRoute().isEmpty()) {
            return false;
        }
        double minDist = Double.MAX_VALUE;
        for (double[] node : loc.getPlannedRoute()) {
            minDist = Math.min(minDist, haversine(dto.getLat(), dto.getLng(), node[0], node[1]));
        }
        return minDist > DEVIATION_THRESHOLD_KM;
    }

    private void publishDeviationEvent(GpsIngestDTO dto) {
        try {
            Map<String, Object> event = new HashMap<>();
            event.put("type", AlertType.ROUTE_DEVIATION.name());
            event.put("vehicleId", dto.getVehicleId());
            event.put("manifestNo", dto.getManifestNo());
            event.put("ts", dto.getTs());
            event.put("lat", dto.getLat());
            event.put("lng", dto.getLng());
            event.put("detail", "车辆偏离规划路线超过2公里");
            event.put("eventTime", LocalDateTime.now().toString());
            redisTemplate.opsForList().rightPush(ALERT_EVENT_QUEUE, JSONUtil.toJsonStr(event));
        } catch (Exception e) {
            log.warn("推送偏离告警事件失败(非阻断): {}", e.getMessage());
        }
    }

    private static double haversine(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
