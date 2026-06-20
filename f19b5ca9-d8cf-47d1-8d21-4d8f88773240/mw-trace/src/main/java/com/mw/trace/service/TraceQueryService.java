package com.mw.trace.service;

import com.alibaba.excel.EasyExcel;
import com.mw.common.exception.BusinessException;
import com.mw.common.response.ResultCode;
import com.mw.trace.dto.StatsExportRow;
import com.mw.trace.dto.StatsItem;
import com.mw.trace.dto.StatisticsRequest;
import com.mw.trace.dto.StatisticsResponse;
import com.mw.trace.dto.TimelineEvent;
import com.mw.trace.dto.TraceTimeline;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TraceQueryService {

    private final MongoTemplate mongoTemplate;

    public TraceTimeline queryByTraceCode(String traceCode) {
        Document record = mongoTemplate.findOne(
                Query.query(Criteria.where("traceCode").is(traceCode)),
                Document.class, "waste_record");
        if (record == null) {
            throw new BusinessException(ResultCode.TRACE_CODE_NOT_EXIST, "追溯编码不存在: " + traceCode);
        }
        String manifestNo = record.getString("manifestNo");
        TraceTimeline timeline = baseTimeline(record);
        List<TimelineEvent> events = new ArrayList<>();
        events.add(event(toLdt(record.get("storageTime")), "产生登记", "废物登记",
                record.get("category") + " / " + record.get("weightKg") + "kg / 科室:" + record.get("department"),
                record.getString("operatorName")));
        events.addAll(buildManifestEvents(manifestNo));
        events.addAll(buildDispatchEvents(manifestNo));
        events.addAll(buildGpsEvents(manifestNo, null));
        events.addAll(buildDisposalEvents(manifestNo));
        events.addAll(buildAlertEvents(traceCode, manifestNo));
        events.sort(Comparator.comparing(TimelineEvent::getTime, Comparator.nullsLast(Comparator.naturalOrder())));
        timeline.setEvents(events);
        return timeline;
    }

    public TraceTimeline queryByManifestNo(String manifestNo) {
        Document manifest = mongoTemplate.findOne(
                Query.query(Criteria.where("manifestNo").is(manifestNo)),
                Document.class, "electronic_manifest");
        if (manifest == null) {
            throw new BusinessException(ResultCode.MANIFEST_NOT_EXIST, "电子联单不存在: " + manifestNo);
        }
        TraceTimeline timeline = new TraceTimeline();
        timeline.setTraceCode(null);
        timeline.setManifestNo(manifestNo);
        timeline.setOrgName(manifest.getString("orgName"));
        timeline.setCategory("MULTI");
        timeline.setWeightKg(manifest.getDouble("totalWeightKg"));
        timeline.setStatus(manifest.getString("status"));
        List<TimelineEvent> events = new ArrayList<>();
        events.add(event(toLdt(manifest.get("createTime")), "电子联单", "联单生成: " + manifestNo,
                "总重量:" + manifest.get("totalWeightKg") + "kg / 追溯码数:"
                        + (manifest.get("traceCodes") instanceof List ? ((List<?>) manifest.get("traceCodes")).size() : 0),
                null));
        events.addAll(buildDispatchEvents(manifestNo));
        events.addAll(buildGpsEvents(manifestNo, null));
        events.addAll(buildDisposalEvents(manifestNo));
        events.addAll(buildAlertEvents(null, manifestNo));
        events.sort(Comparator.comparing(TimelineEvent::getTime, Comparator.nullsLast(Comparator.naturalOrder())));
        timeline.setEvents(events);
        return timeline;
    }

    public StatisticsResponse statistics(StatisticsRequest req) {
        StatisticsResponse resp = new StatisticsResponse();
        Map<String, StatsItem> current = aggregate(req.getOrgId(), req.getStartTime(), req.getEndTime(), req.getGroupBy());
        List<StatsItem> items = new ArrayList<>(current.values());
        items.sort(Comparator.comparing(StatsItem::getGroupKey, Comparator.nullsLast(Comparator.naturalOrder())));
        resp.setItems(items);
        resp.setTotalProducedKg(sum(items, StatsItem::getProducedKg));
        resp.setTotalTransferredKg(sum(items, StatsItem::getTransferredKg));
        resp.setTotalDisposedKg(sum(items, StatsItem::getDisposedKg));

        Duration d = Duration.between(req.getStartTime(), req.getEndTime());
        LocalDateTime prevStart = req.getStartTime().minus(d);
        Map<String, StatsItem> prev = aggregate(req.getOrgId(), prevStart, req.getStartTime(), req.getGroupBy());
        resp.setPrevTotalProducedKg(sum(prev.values().stream().toList(), StatsItem::getProducedKg));
        resp.setPrevTotalTransferredKg(sum(prev.values().stream().toList(), StatsItem::getTransferredKg));
        resp.setPrevTotalDisposedKg(sum(prev.values().stream().toList(), StatsItem::getDisposedKg));
        resp.setProducedChangePct(changePct(resp.getTotalProducedKg(), resp.getPrevTotalProducedKg()));
        resp.setTransferredChangePct(changePct(resp.getTotalTransferredKg(), resp.getPrevTotalTransferredKg()));
        resp.setDisposedChangePct(changePct(resp.getTotalDisposedKg(), resp.getPrevTotalDisposedKg()));
        return resp;
    }

    public byte[] exportExcel(StatisticsRequest req) {
        StatisticsResponse resp = statistics(req);
        List<StatsExportRow> rows = resp.getItems().stream().map(it -> {
            StatsExportRow row = new StatsExportRow();
            row.setGroupKey(it.getGroupKey());
            row.setProducedKg(it.getProducedKg());
            row.setTransferredKg(it.getTransferredKg());
            row.setDisposedKg(it.getDisposedKg());
            row.setProducedCount(it.getProducedCount());
            return row;
        }).collect(Collectors.toList());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        EasyExcel.write(out, StatsExportRow.class).sheet("医疗废物统计").doWrite(rows);
        return out.toByteArray();
    }

    private Map<String, StatsItem> aggregate(String orgId, LocalDateTime start, LocalDateTime end, String groupBy) {
        Map<String, StatsItem> map = new HashMap<>();
        aggregateProduced(map, orgId, start, end, groupBy);
        aggregateTransferred(map, orgId, start, end, groupBy);
        aggregateDisposed(map, orgId, start, end, groupBy);
        return map;
    }

    private void aggregateProduced(Map<String, StatsItem> map, String orgId, LocalDateTime start, LocalDateTime end, String groupBy) {
        List<Document> pipeline = new ArrayList<>();
        Document match = new Document("storageTime", new Document("$gte", toDate(start)).append("$lte", toDate(end)));
        if (orgId != null && !orgId.isBlank()) {
            match.put("orgId", orgId);
        }
        pipeline.add(new Document("$match", match));
        pipeline.add(new Document("$group", new Document("_id", groupIdExpr("storageTime", groupBy))
                .append("producedKg", new Document("$sum", "$weightKg"))
                .append("producedCount", new Document("$sum", 1))));
        for (Document d : mongoTemplate.getCollection("waste_record").aggregate(pipeline).into(new ArrayList<>())) {
            StatsItem item = map.computeIfAbsent(key(d.get("_id")), k -> newItem(k));
            item.setProducedKg(round(d.getDouble("producedKg")));
            item.setProducedCount(d.get("producedCount") instanceof Number ? ((Number) d.get("producedCount")).longValue() : 0L);
        }
    }

    private void aggregateTransferred(Map<String, StatsItem> map, String orgId, LocalDateTime start, LocalDateTime end, String groupBy) {
        List<Document> pipeline = new ArrayList<>();
        Document match = new Document("dispatchTime", new Document("$gte", toDate(start)).append("$lte", toDate(end)));
        pipeline.add(new Document("$match", match));
        pipeline.add(new Document("$group", new Document("_id", groupIdExpr("dispatchTime", groupBy))
                .append("transferredKg", new Document("$sum", "$plannedWeightKg"))));
        for (Document d : mongoTemplate.getCollection("dispatch_order").aggregate(pipeline).into(new ArrayList<>())) {
            StatsItem item = map.computeIfAbsent(key(d.get("_id")), k -> newItem(k));
            item.setTransferredKg(round(d.getDouble("transferredKg")));
        }
    }

    private void aggregateDisposed(Map<String, StatsItem> map, String orgId, LocalDateTime start, LocalDateTime end, String groupBy) {
        List<Document> pipeline = new ArrayList<>();
        Document match = new Document("startTime", new Document("$gte", toDate(start)).append("$lte", toDate(end)));
        pipeline.add(new Document("$match", match));
        pipeline.add(new Document("$lookup",
                new Document("from", "electronic_manifest")
                        .append("localField", "manifestNo")
                        .append("foreignField", "manifestNo")
                        .append("as", "manifest")));
        pipeline.add(new Document("$unwind", "$manifest"));
        pipeline.add(new Document("$group", new Document("_id", groupIdExpr("startTime", groupBy))
                .append("disposedKg", new Document("$sum", "$manifest.totalWeightKg"))));
        for (Document d : mongoTemplate.getCollection("disposal_batch").aggregate(pipeline).into(new ArrayList<>())) {
            StatsItem item = map.computeIfAbsent(key(d.get("_id")), k -> newItem(k));
            item.setDisposedKg(round(d.getDouble("disposedKg")));
        }
    }

    private Object groupIdExpr(String timeField, String groupBy) {
        if ("ORG".equalsIgnoreCase(groupBy)) {
            return "$orgId";
        }
        if ("CATEGORY".equalsIgnoreCase(groupBy)) {
            return "$category";
        }
        return new Document("$dateToString", new Document("format", "%Y-%m-%d").append("date", "$" + timeField));
    }

    private List<TimelineEvent> buildManifestEvents(String manifestNo) {
        List<TimelineEvent> events = new ArrayList<>();
        if (manifestNo == null) {
            return events;
        }
        Document m = mongoTemplate.findOne(Query.query(Criteria.where("manifestNo").is(manifestNo)),
                Document.class, "electronic_manifest");
        if (m != null) {
            events.add(event(toLdt(m.get("createTime")), "电子联单", "联单生成: " + manifestNo,
                    "总重量:" + m.get("totalWeightKg") + "kg", null));
        }
        return events;
    }

    private List<TimelineEvent> buildDispatchEvents(String manifestNo) {
        List<TimelineEvent> events = new ArrayList<>();
        if (manifestNo == null) {
            return events;
        }
        List<Document> orders = mongoTemplate.find(Query.query(Criteria.where("manifestNo").is(manifestNo)),
                Document.class, "dispatch_order");
        for (Document o : orders) {
            events.add(event(toLdt(o.get("dispatchTime")), "收运调度", "派单: " + o.get("orderNo"),
                    "车辆:" + o.get("vehicleId") + " / 司机:" + o.get("driverName"), null));
            if (o.get("acceptTime") != null) {
                events.add(event(toLdt(o.get("acceptTime")), "收运调度", "司机确认收运",
                        "派单:" + o.get("orderNo"), o.getString("driverName")));
            }
            if (o.get("completeTime") != null) {
                events.add(event(toLdt(o.get("completeTime")), "收运调度", "收运完成",
                        "实收重量:" + o.get("actualWeightKg") + "kg", null));
            }
        }
        return events;
    }

    private List<TimelineEvent> buildGpsEvents(String manifestNo, String vehicleId) {
        List<TimelineEvent> events = new ArrayList<>();
        Criteria criteria = new Criteria();
        if (vehicleId != null) {
            criteria = Criteria.where("vehicleId").is(vehicleId);
        } else if (manifestNo != null) {
            criteria = Criteria.where("manifestNo").is(manifestNo);
        } else {
            return events;
        }
        List<Document> points = mongoTemplate.find(Query.query(criteria),
                Document.class, "gps_point");
        int limit = Math.min(points.size(), 50);
        for (int i = 0; i < limit; i++) {
            Document p = points.get(i);
            events.add(event(toLdt(p.get("ts")), "车辆轨迹", "GPS上报",
                    String.format("位置:%.5f,%.5f / 速度:%.1fkm/h / 偏离:%s",
                            p.getDouble("lat"), p.getDouble("lng"),
                            p.get("speed") == null ? 0 : p.getDouble("speed"),
                            Boolean.TRUE.equals(p.getBoolean("deviated")) ? "是" : "否"),
                    null));
        }
        return events;
    }

    private List<TimelineEvent> buildDisposalEvents(String manifestNo) {
        List<TimelineEvent> events = new ArrayList<>();
        if (manifestNo == null) {
            return events;
        }
        List<Document> batches = mongoTemplate.find(Query.query(Criteria.where("manifestNo").is(manifestNo)),
                Document.class, "disposal_batch");
        for (Document b : batches) {
            events.add(event(toLdt(b.get("startTime")), "处置", "入炉批次: " + b.get("batchNo"),
                    "工艺:" + b.get("disposalMethod") + " / 合格:" + b.get("qualified"), null));
            if (b.get("endTime") != null) {
                events.add(event(toLdt(b.get("endTime")), "处置", "处置完成",
                        "灭菌时长:" + b.get("sterilizationDurationMinutes") + "min / 复核:" + b.get("reviewStatus"), null));
            }
        }
        return events;
    }

    private List<TimelineEvent> buildAlertEvents(String traceCode, String manifestNo) {
        List<TimelineEvent> events = new ArrayList<>();
        List<String> keys = new ArrayList<>();
        if (traceCode != null) {
            keys.add(traceCode);
        }
        if (manifestNo != null) {
            keys.add(manifestNo);
        }
        if (keys.isEmpty()) {
            return events;
        }
        List<Document> alerts = mongoTemplate.find(
                Query.query(Criteria.where("businessKey").in(keys)), Document.class, "alert");
        for (Document a : alerts) {
            events.add(event(toLdt(a.get("createTime")), "监管预警",
                    String.valueOf(a.get("type")), a.getString("detail"), null));
        }
        return events;
    }

    private TraceTimeline baseTimeline(Document record) {
        TraceTimeline timeline = new TraceTimeline();
        timeline.setTraceCode(record.getString("traceCode"));
        timeline.setManifestNo(record.getString("manifestNo"));
        timeline.setOrgName(record.getString("orgName"));
        timeline.setCategory(String.valueOf(record.get("category")));
        timeline.setWeightKg(record.getDouble("weightKg"));
        timeline.setStatus(String.valueOf(record.get("status")));
        return timeline;
    }

    private TimelineEvent event(LocalDateTime time, String stage, String title, String detail, String operator) {
        TimelineEvent e = new TimelineEvent();
        e.setTime(time);
        e.setStage(stage);
        e.setTitle(title);
        e.setDetail(detail);
        e.setOperator(operator);
        return e;
    }

    private LocalDateTime toLdt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof java.util.Date d) {
            return LocalDateTime.ofInstant(d.toInstant(), ZoneId.systemDefault());
        }
        if (v instanceof LocalDateTime l) {
            return l;
        }
        if (v instanceof Number n) {
            return LocalDateTime.ofInstant(Instant.ofEpochMilli(n.longValue()), ZoneId.systemDefault());
        }
        return null;
    }

    private Date toDate(LocalDateTime ldt) {
        return Date.from(ldt.atZone(ZoneId.systemDefault()).toInstant());
    }

    private String key(Object id) {
        return id == null ? "unknown" : id.toString();
    }

    private StatsItem newItem(String groupKey) {
        StatsItem item = new StatsItem();
        item.setGroupKey(groupKey);
        return item;
    }

    private Double round(Double v) {
        return v == null ? 0.0 : Math.round(v * 100.0) / 100.0;
    }

    private Double sum(List<StatsItem> items, java.util.function.Function<StatsItem, Double> getter) {
        return round(items.stream().mapToDouble(i -> getter.apply(i) == null ? 0 : getter.apply(i)).sum());
    }

    private Double changePct(Double current, Double previous) {
        if (previous == null || previous == 0) {
            return null;
        }
        return Math.round((current - previous) / previous * 10000.0) / 100.0;
    }
}
