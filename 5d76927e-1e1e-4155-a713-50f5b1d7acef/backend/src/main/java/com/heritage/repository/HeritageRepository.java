package com.heritage.repository;

import com.heritage.entity.Heritage;
import com.heritage.enums.HeritageCategory;
import com.heritage.enums.HeritageLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HeritageRepository extends MongoRepository<Heritage, String> {

    Page<Heritage> findByPublishedTrue(Pageable pageable);

    Page<Heritage> findByCategoryAndPublishedTrue(HeritageCategory category, Pageable pageable);

    Page<Heritage> findByLevelAndPublishedTrue(HeritageLevel level, Pageable pageable);

    Page<Heritage> findByCategoryAndLevelAndPublishedTrue(
            HeritageCategory category, HeritageLevel level, Pageable pageable);

    @Query("{ 'name': { $regex: ?0, $options: 'i' }, 'published': true }")
    Page<Heritage> searchByName(String keyword, Pageable pageable);

    @Query("{ 'region': { $regex: ?0, $options: 'i' }, 'published': true }")
    Page<Heritage> findByRegionContaining(String region, Pageable pageable);

    List<Heritage> findByInheritorIdsContaining(String inheritorId);

    List<Heritage> findTop10ByPublishedTrueOrderByHotScoreDesc();
}
