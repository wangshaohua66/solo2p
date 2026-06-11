package com.scriptkill.repository;

import com.scriptkill.entity.ScriptCharacter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScriptCharacterRepository extends JpaRepository<ScriptCharacter, Long> {

    List<ScriptCharacter> findByScriptId(Long scriptId);

    List<ScriptCharacter> findByScriptIdOrderBySortOrderAsc(Long scriptId);

    List<ScriptCharacter> findByScriptIdAndGender(Long scriptId, String gender);
}
