package com.scriptkill.repository;

import com.scriptkill.entity.Script;
import com.scriptkill.entity.enums.ScriptDifficulty;
import com.scriptkill.entity.enums.ScriptGenre;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ScriptRepository extends JpaRepository<Script, Long> {

    List<Script> findByStatus(String status);

    List<Script> findByGenre(ScriptGenre genre);

    List<Script> findByDifficulty(ScriptDifficulty difficulty);

    Page<Script> findByStatus(String status, Pageable pageable);

    @Query("SELECT s FROM Script s WHERE s.status = 'ACTIVE' AND " +
           "(:genre IS NULL OR s.genre = :genre) AND " +
           "(:difficulty IS NULL OR s.difficulty = :difficulty) AND " +
           "(:minPlayers IS NULL OR s.maxPlayers >= :minPlayers) AND " +
           "(:maxPlayers IS NULL OR s.minPlayers <= :maxPlayers)")
    Page<Script> searchScripts(ScriptGenre genre, ScriptDifficulty difficulty,
                                Integer minPlayers, Integer maxPlayers, Pageable pageable);

    boolean existsByName(String name);

    @Query("SELECT s FROM Script s WHERE s.status = 'ACTIVE' ORDER BY s.averageRating DESC")
    List<Script> findTopRatedScripts(Pageable pageable);
}
