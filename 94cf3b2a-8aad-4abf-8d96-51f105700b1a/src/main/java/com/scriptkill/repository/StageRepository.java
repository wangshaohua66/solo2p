package com.scriptkill.repository;

import com.scriptkill.entity.Stage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StageRepository extends JpaRepository<Stage, Long> {

    List<Stage> findByScriptIdOrderByStageOrderAsc(Long scriptId);

    Optional<Stage> findByScriptIdAndStageOrder(Long scriptId, Integer stageOrder);

    long countByScriptId(Long scriptId);
}
