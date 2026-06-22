package com.heritage.repository;

import com.heritage.entity.Inheritor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InheritorRepository extends MongoRepository<Inheritor, String> {

    Page<Inheritor> findAll(Pageable pageable);

    List<Inheritor> findByHeritageIdsContaining(String heritageId);

    List<Inheritor> findByMasterId(String masterId);

    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<Inheritor> searchByName(String keyword, Pageable pageable);

    @Query("{ 'region': { $regex: ?0, $options: 'i' } }")
    Page<Inheritor> findByRegionContaining(String region, Pageable pageable);

    List<Inheritor> findByUserId(String userId);
}
