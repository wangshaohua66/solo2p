package com.heritage.repository;

import com.heritage.entity.TrainingPlan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TrainingPlanRepository extends MongoRepository<TrainingPlan, String> {

    Page<TrainingPlan> findByInheritorId(String inheritorId, Pageable pageable);

    List<TrainingPlan> findByInheritorIdAndYear(String inheritorId, String year);

    List<TrainingPlan> findByYear(String year);

    List<TrainingPlan> findByHeritageId(String heritageId);
}
