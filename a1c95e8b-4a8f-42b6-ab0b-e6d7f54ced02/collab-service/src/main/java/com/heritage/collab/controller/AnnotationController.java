package com.heritage.collab.controller;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.util.IdUtil;
import com.heritage.collab.common.Result;
import com.heritage.collab.entity.Annotation;
import com.heritage.collab.feign.UserClient;
import com.heritage.collab.repository.AnnotationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping({"/annotations", "/annotation"})
@RequiredArgsConstructor
public class AnnotationController {

    private final AnnotationRepository repository;
    private final MongoTemplate mongoTemplate;
    private final UserClient userClient;

    @PostMapping
    public Result<Annotation> create(@RequestBody Annotation a,
                                     @RequestHeader(value = "X-User-Id", required = false) String uid,
                                     @RequestHeader(value = "X-Username", required = false) String uname) {
        if (a.getId() == null || a.getId().isEmpty()) a.setId(IdUtil.fastSimpleUUID());
        if (a.getExpertId() == null && uid != null) a.setExpertId(uid);
        if (a.getExpertName() == null && uname != null) a.setExpertName(uname);
        if (a.getCreateTime() == null) a.setCreateTime(LocalDateTime.now());
        a.setUpdateTime(LocalDateTime.now());
        if (a.getZIndex() == null) a.setZIndex(0);
        if (a.getVisible() == null) a.setVisible(true);
        if (a.getLocked() == null) a.setLocked(false);
        Annotation saved = repository.save(a);
        try {
            if (uid != null) userClient.getUserById(uid);
        } catch (Exception e) {
            log.debug("UserClient 调用跳过: {}", e.getMessage());
        }
        return Result.success(saved);
    }

    @PostMapping("/batch")
    public Result<Map<String, Object>> batchSave(@RequestBody List<Annotation> list,
                                                 @RequestHeader(value = "X-User-Id", required = false) String uid,
                                                 @RequestHeader(value = "X-Username", required = false) String uname) {
        LocalDateTime now = LocalDateTime.now();
        int zBase = 0;
        for (Annotation a : list) {
            if (a.getId() == null || a.getId().isEmpty()) a.setId(IdUtil.fastSimpleUUID());
            if (a.getExpertId() == null) a.setExpertId(uid);
            if (a.getExpertName() == null) a.setExpertName(uname);
            if (a.getCreateTime() == null) a.setCreateTime(now);
            a.setUpdateTime(now);
            if (a.getZIndex() == null) a.setZIndex(zBase++);
            if (a.getVisible() == null) a.setVisible(true);
            if (a.getLocked() == null) a.setLocked(false);
            if (a.getVersion() == null) a.setVersion(1);
        }
        List<Annotation> saved = repository.saveAll(list);
        return Result.success(Map.of(
            "count", saved.size(),
            "ids", saved.stream().map(Annotation::getId).collect(Collectors.toList())
        ));
    }

    @GetMapping("/{id}")
    public Result<Annotation> get(@PathVariable String id) {
        return Result.success(repository.findById(id).orElseThrow(()->new RuntimeException("标注不存在")));
    }

    @PutMapping("/{id}")
    public Result<Annotation> update(@PathVariable String id, @RequestBody Annotation a) {
        Annotation ex = repository.findById(id).orElseThrow(()->new RuntimeException("标注不存在"));
        BeanUtil.copyProperties(a, ex, "id","createTime","expertId","imageId","artifactId","appraisalId");
        ex.setUpdateTime(LocalDateTime.now());
        if (ex.getVersion() != null) ex.setVersion(ex.getVersion() + 1);
        return Result.success(repository.save(ex));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable String id) {
        repository.deleteById(id);
        return Result.success(null);
    }

    @GetMapping("/list/image/{imageId}")
    public Result<List<Annotation>> listByImage(@PathVariable String imageId,
                                                @RequestParam(required = false) String tool) {
        Query q = Query.query(Criteria.where("imageId").is(imageId));
        if (tool != null && !tool.isEmpty()) q.addCriteria(Criteria.where("tool").is(tool));
        q.fields().exclude("replies");
        List<Annotation> list = mongoTemplate.find(q.with(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.ASC,"zIndex")), Annotation.class);
        return Result.success(list);
    }

    @GetMapping("/list/appraisal/{appraisalId}")
    public Result<List<Annotation>> listByAppraisal(@PathVariable String appraisalId) {
        return Result.success(repository.findByAppraisalId(appraisalId));
    }

    @GetMapping("/list/artifact/{artifactId}")
    public Result<List<Annotation>> listByArtifact(@PathVariable String artifactId) {
        return Result.success(repository.findByArtifactId(artifactId));
    }

    @DeleteMapping("/image/{imageId}")
    public Result<Long> deleteByImage(@PathVariable String imageId) {
        Query q = Query.query(Criteria.where("imageId").is(imageId));
        long n = mongoTemplate.count(q, Annotation.class);
        mongoTemplate.remove(q, Annotation.class);
        return Result.success(n);
    }

    @GetMapping("/stats/image/{imageId}")
    public Result<Map<String, Object>> stats(@PathVariable String imageId) {
        List<Annotation> all = repository.findByImageId(imageId);
        Map<String, Long> byTool = all.stream().collect(Collectors.groupingBy(a->a.getTool()==null?"unknown":a.getTool(), Collectors.counting()));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", all.size());
        m.put("byTool", byTool);
        m.put("expertCount", all.stream().map(Annotation::getExpertId).filter(Objects::nonNull).distinct().count());
        return Result.success(m);
    }

    @PostMapping("/export/{imageId}")
    public Result<Map<String, Object>> exportJSON(@PathVariable String imageId) {
        List<Annotation> list = repository.findByImageId(imageId);
        return Result.success(Map.of(
            "imageId", imageId,
            "exportTime", LocalDateTime.now().toString(),
            "count", list.size(),
            "version", "1.0",
            "annotations", list
        ));
    }
}
