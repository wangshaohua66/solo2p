package com.heritage.artifact.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.collection.CollUtil;
import cn.hutool.core.util.StrUtil;
import com.heritage.artifact.config.ArtifactSearchProperties;
import com.heritage.artifact.dto.ArtifactSearchDTO;
import com.heritage.artifact.entity.Artifact;
import com.heritage.artifact.entity.ArtifactEsIndex;
import com.heritage.artifact.repository.ArtifactEsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.*;
import org.springframework.data.elasticsearch.core.query.HighlightQuery;
import org.springframework.data.elasticsearch.core.query.highlight.Highlight;
import org.springframework.data.elasticsearch.core.query.highlight.HighlightField;
import org.springframework.data.elasticsearch.core.query.highlight.HighlightParameters;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ArtifactSearchService {

    private final ArtifactEsRepository esRepository;
    private final ElasticsearchOperations elasticsearchOperations;
    private final MongoTemplate mongoTemplate;
    private final ArtifactSearchProperties searchProps;

    public ArtifactEsIndex toEsDoc(Artifact a) {
        if (a == null) return null;
        List<String> imgUrls = CollUtil.emptyIfNull(a.getImages()).stream()
            .map(img -> img.getFileUrl()).filter(Objects::nonNull).collect(Collectors.toList());
        String allText = String.join(" ",
            StrUtil.nullToEmpty(a.getName()),
            StrUtil.nullToEmpty(a.getArtifactCode()),
            StrUtil.nullToEmpty(a.getSubtitle()),
            StrUtil.nullToEmpty(a.getDynasty()),
            StrUtil.nullToEmpty(a.getEra()),
            StrUtil.nullToEmpty(a.getOrigin()),
            StrUtil.nullToEmpty(a.getMaterial()),
            StrUtil.nullToEmpty(a.getTechnique()),
            StrUtil.nullToEmpty(a.getInscription()),
            StrUtil.nullToEmpty(a.getDescription()),
            StrUtil.nullToEmpty(a.getHistoricalNote())
        );
        return ArtifactEsIndex.builder()
            .id(a.getId())
            .artifactCode(a.getArtifactCode())
            .name(a.getName())
            .subtitle(a.getSubtitle())
            .type(a.getType() != null ? a.getType().name() : null)
            .level(a.getLevel() != null ? a.getLevel().name() : null)
            .status(a.getStatus() != null ? a.getStatus().name() : null)
            .dynasty(a.getDynasty())
            .era(a.getEra())
            .origin(a.getOrigin())
            .discoveryLocation(a.getDiscoveryLocation())
            .currentLocation(a.getCurrentLocation())
            .material(a.getMaterial())
            .technique(a.getTechnique())
            .inscription(a.getInscription())
            .description(a.getDescription())
            .historicalNote(a.getHistoricalNote())
            .owner(a.getOwner())
            .custodian(a.getCustodian())
            .createdBy(a.getCreatedBy())
            .dataAccessLevel(a.getDataAccessLevel())
            .createTime(a.getCreateTime())
            .updateTime(a.getUpdateTime())
            .imageUrls(imgUrls)
            .allText(allText)
            .build();
    }

    @Async
    public void syncSave(Artifact artifact) {
        try {
            if (artifact == null || artifact.getId() == null) return;
            ArtifactEsIndex doc = toEsDoc(artifact);
            esRepository.save(doc);
            log.debug("ES 同步保存成功: id={}", artifact.getId());
        } catch (Exception e) {
            log.warn("ES 同步保存失败: id={}, err={}", artifact != null ? artifact.getId() : null, e.getMessage());
        }
    }

    @Async
    public void syncDelete(String id) {
        try {
            if (id == null) return;
            esRepository.deleteById(id);
            log.debug("ES 同步删除成功: id={}", id);
        } catch (Exception e) {
            log.warn("ES 同步删除失败: id={}, err={}", id, e.getMessage());
        }
    }

    @Async
    public long fullReindex() {
        log.info("开始 ES 全量重建索引...");
        final long[] count = {0};
        try {
            esRepository.deleteAll();
            mongoTemplate.stream(new org.springframework.data.mongodb.core.query.Query(), Artifact.class)
                .forEachRemaining(a -> {
                    esRepository.save(toEsDoc(a));
                    count[0]++;
                });
        } catch (Exception e) {
            log.error("ES 全量重建失败: {}", e.getMessage(), e);
        }
        log.info("ES 全量重建完成，共 {} 条", count[0]);
        return count[0];
    }

    public Page<Artifact> search(ArtifactSearchDTO dto, boolean fallbackMongo) {
        if (!searchProps.isUseElasticsearch()) {
            if (fallbackMongo) return mongoSearch(dto);
            return Page.empty();
        }
        try {
            return esSearch(dto);
        } catch (Exception e) {
            log.warn("ES 检索失败，回退MongoDB: {}", e.getMessage());
            if (searchProps.isFallbackToMongo() && fallbackMongo) return mongoSearch(dto);
            return Page.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private Page<Artifact> esSearch(ArtifactSearchDTO dto) {
        Sort sort = Sort.by(Sort.Direction.fromString(dto.getSortDir().toUpperCase(Locale.ROOT)), dto.getSortBy());
        Pageable pageable = PageRequest.of(dto.getPage(), dto.getSize(), sort);

        List<HighlightField> fields = Arrays.asList(
            new HighlightField("name"),
            new HighlightField("description"),
            new HighlightField("material"),
            new HighlightField("dynasty"),
            new HighlightField("technique"),
            new HighlightField("historicalNote")
        );
        HighlightParameters parameters = HighlightParameters.builder()
            .withPreTags(searchProps.getHighlightPreTags())
            .withPostTags(searchProps.getHighlightPostTags())
            .withFragmentSize(200)
            .withNumberOfFragments(3)
            .withRequireFieldMatch(true)
            .build();
        HighlightQuery hq = new HighlightQuery(new Highlight(parameters, fields), null);

        NativeQuery.Builder qb = NativeQuery.builder()
            .withPageable(pageable)
            .withHighlightQuery(hq)
            .withTrackScores(true)
            .withRoute(null);

        List<Map<String, Object>> mustClauses = new ArrayList<>();
        List<Map<String, Object>> filterClauses = new ArrayList<>();

        if (StrUtil.isNotBlank(dto.getKeyword())) {
            Map<String, Object> mm = new HashMap<>();
            Map<String, Object> mma = new HashMap<>();
            mma.put("query", dto.getKeyword());
            mma.put("fields", Arrays.asList("name^5","name.pinyin^3","artifactCode^3","description^2","material^1.5","dynasty^2","technique^1.5","historicalNote","inscription","allText"));
            mma.put("type", "best_fields");
            mma.put("operator", "and");
            mma.put("minimum_should_match", "75%");
            mma.put("tie_breaker", 0.3);
            mm.put("multi_match", mma);
            mustClauses.add(mm);
        }
        if (dto.getType() != null) filterClauses.add(Map.of("term", Map.of("type", dto.getType().name())));
        if (dto.getLevel() != null) filterClauses.add(Map.of("term", Map.of("level", dto.getLevel().name())));
        if (dto.getStatus() != null) filterClauses.add(Map.of("term", Map.of("status", dto.getStatus().name())));
        if (StrUtil.isNotBlank(dto.getDynasty())) filterClauses.add(Map.of("term", Map.of("dynasty.keyword", dto.getDynasty())));
        if (StrUtil.isNotBlank(dto.getEra())) filterClauses.add(Map.of("match", Map.of("era", dto.getEra())));
        if (StrUtil.isNotBlank(dto.getOrigin())) filterClauses.add(Map.of("match", Map.of("origin", dto.getOrigin())));
        if (dto.getDataAccessLevel() != null) filterClauses.add(Map.of("range", Map.of("dataAccessLevel", Map.of("lte", dto.getDataAccessLevel()))));

        Map<String, Object> bool = new LinkedHashMap<>();
        if (!mustClauses.isEmpty()) bool.put("must", mustClauses);
        if (!filterClauses.isEmpty()) bool.put("filter", filterClauses);
        Map<String, Object> query = Map.of("bool", bool);

        NativeQuery nq = qb.withQuery(query).build();

        SearchHits<ArtifactEsIndex> hits = elasticsearchOperations.search(nq, ArtifactEsIndex.class);
        List<String> ids = hits.getSearchHits().stream()
            .map(h -> h.getContent().getId())
            .collect(Collectors.toList());

        Map<String, Artifact> map = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            List<Artifact> dbList = mongoTemplate.find(
                new org.springframework.data.mongodb.core.query.Query(org.springframework.data.mongodb.core.query.Criteria.where("_id").in(ids)),
                Artifact.class
            );
            dbList.forEach(a -> map.put(a.getId(), a));
        }
        List<Artifact> ordered = ids.stream().filter(map::containsKey).map(map::get).collect(Collectors.toList());

        return new PageImpl<>(ordered, pageable, hits.getTotalHits());
    }

    private Page<Artifact> mongoSearch(ArtifactSearchDTO dto) {
        org.springframework.data.mongodb.core.query.Query query = new org.springframework.data.mongodb.core.query.Query();
        if (StrUtil.isNotBlank(dto.getKeyword())) {
            String regex = ".*" + dto.getKeyword() + ".*";
            query.addCriteria(new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                org.springframework.data.mongodb.core.query.Criteria.where("name").regex(regex, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("artifactCode").regex(regex, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("description").regex(regex, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("dynasty").regex(regex, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("material").regex(regex, "i")
            ));
        }
        if (dto.getType() != null)
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("type").is(dto.getType()));
        if (dto.getLevel() != null)
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("level").is(dto.getLevel()));
        if (dto.getStatus() != null)
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").is(dto.getStatus()));
        if (StrUtil.isNotBlank(dto.getDynasty()))
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("dynasty").regex(dto.getDynasty(), "i"));
        if (StrUtil.isNotBlank(dto.getEra()))
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("era").regex(dto.getEra(), "i"));
        if (StrUtil.isNotBlank(dto.getOrigin()))
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("origin").regex(dto.getOrigin(), "i"));
        if (dto.getDataAccessLevel() != null)
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("dataAccessLevel").lte(dto.getDataAccessLevel()));

        Sort sort = Sort.by(Sort.Direction.fromString(dto.getSortDir().toUpperCase(Locale.ROOT)), dto.getSortBy());
        PageRequest pageable = PageRequest.of(dto.getPage(), dto.getSize(), sort);
        query.with(pageable);

        List<Artifact> list = mongoTemplate.find(query, Artifact.class);
        long total = mongoTemplate.count(org.springframework.data.mongodb.core.query.Query.of(query).limit(-1).skip(-1), Artifact.class);
        return org.springframework.data.support.PageableExecutionUtils.getPage(list, pageable, () -> total);
    }

    public void afterCommitSync(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { action.run(); }
            });
        } else {
            action.run();
        }
    }
}
