package com.heritage.service;

import com.heritage.entity.Heritage;
import com.heritage.entity.MediaFile;
import com.heritage.entity.VersionHistory;
import com.heritage.enums.HeritageCategory;
import com.heritage.enums.HeritageLevel;
import com.heritage.repository.HeritageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class HeritageService {

    @Autowired
    private HeritageRepository heritageRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    public Page<Heritage> searchHeritages(String keyword, HeritageCategory category,
                                           HeritageLevel level, String region,
                                           boolean publishedOnly, Pageable pageable) {
        Query query = new Query();

        if (publishedOnly) {
            query.addCriteria(Criteria.where("published").is(true));
        }

        if (StringUtils.hasText(keyword)) {
            query.addCriteria(Criteria.where("name").regex(keyword, "i"));
        }

        if (category != null) {
            query.addCriteria(Criteria.where("category").is(category));
        }

        if (level != null) {
            query.addCriteria(Criteria.where("level").is(level));
        }

        if (StringUtils.hasText(region)) {
            query.addCriteria(Criteria.where("region").regex(region, "i"));
        }

        long total = mongoTemplate.count(query, Heritage.class);

        query.with(pageable).with(Sort.by(Sort.Direction.DESC, "hotScore", "createdAt"));

        List<Heritage> list = mongoTemplate.find(query, Heritage.class);

        return new org.springframework.data.domain.PageImpl<>(list, pageable, total);
    }

    public Optional<Heritage> findById(String id) {
        return heritageRepository.findById(id);
    }

    public Heritage getHeritageDetail(String id) {
        Optional<Heritage> heritageOpt = heritageRepository.findById(id);
        if (heritageOpt.isPresent()) {
            Heritage heritage = heritageOpt.get();
            heritage.setViewCount(heritage.getViewCount() + 1);
            heritage.setHotScore(heritage.getHotScore() + 1);
            heritageRepository.save(heritage);
            return heritage;
        }
        return null;
    }

    @Transactional
    public Heritage createHeritage(Heritage heritage, String username) {
        heritage.setId(null);
        heritage.setViewCount(0);
        heritage.setHotScore(0);
        heritage.setCreatedBy(username);
        heritage.setUpdatedBy(username);

        VersionHistory version = VersionHistory.builder()
                .version("v1.0")
                .changeLog("初始版本创建")
                .modifiedBy(username)
                .modifiedAt(LocalDateTime.now())
                .build();
        heritage.setVersionHistory(List.of(version));

        if (heritage.getMediaFiles() != null) {
            heritage.getMediaFiles().forEach(f -> {
                f.setId(UUID.randomUUID().toString());
                f.setUploadedAt(LocalDateTime.now());
                f.setUploadedBy(username);
            });
        }

        return heritageRepository.save(heritage);
    }

    @Transactional
    public Heritage updateHeritage(String id, Heritage heritage, String username) {
        Heritage existing = heritageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("非遗项目不存在"));

        int currentVersion = existing.getVersionHistory().size() + 1;
        VersionHistory version = VersionHistory.builder()
                .version("v" + currentVersion + ".0")
                .changeLog("版本更新")
                .modifiedBy(username)
                .modifiedAt(LocalDateTime.now())
                .build();

        existing.setName(heritage.getName());
        existing.setCategory(heritage.getCategory());
        existing.setLevel(heritage.getLevel());
        existing.setRegion(heritage.getRegion());
        existing.setSummary(heritage.getSummary());
        existing.setDescription(heritage.getDescription());
        existing.setHistory(heritage.getHistory());
        existing.setCharacteristics(heritage.getCharacteristics());
        existing.setCoverImage(heritage.getCoverImage());
        existing.setInheritorIds(heritage.getInheritorIds());
        existing.setMediaFiles(heritage.getMediaFiles());
        existing.setPublished(heritage.isPublished());
        existing.setUpdatedBy(username);
        existing.getVersionHistory().add(version);

        return heritageRepository.save(existing);
    }

    public void deleteHeritage(String id) {
        heritageRepository.deleteById(id);
    }

    public List<Heritage> getHotHeritages(int limit) {
        return heritageRepository.findTop10ByPublishedTrueOrderByHotScoreDesc()
                .stream()
                .limit(limit)
                .toList();
    }

    public Heritage addMediaFile(String heritageId, MediaFile mediaFile, String username) {
        Heritage heritage = heritageRepository.findById(heritageId)
                .orElseThrow(() -> new RuntimeException("非遗项目不存在"));

        mediaFile.setId(UUID.randomUUID().toString());
        mediaFile.setUploadedAt(LocalDateTime.now());
        mediaFile.setUploadedBy(username);

        heritage.getMediaFiles().add(mediaFile);
        heritage.setUpdatedBy(username);
        return heritageRepository.save(heritage);
    }
}
