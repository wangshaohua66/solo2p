package com.scriptkill.repository;

import com.scriptkill.entity.Clue;
import com.scriptkill.entity.enums.ClueTriggerType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClueRepository extends JpaRepository<Clue, Long> {

    List<Clue> findByScriptId(Long scriptId);

    List<Clue> findByScriptIdAndStageId(Long scriptId, Long stageId);

    List<Clue> findByScriptIdAndTriggerType(Long scriptId, ClueTriggerType triggerType);

    List<Clue> findByScriptIdOrderBySortOrderAsc(Long scriptId);

    List<Clue> findByScriptIdAndClueLevel(Long scriptId, Integer clueLevel);

    List<Clue> findByStageIdOrderBySortOrderAsc(Long stageId);
}
