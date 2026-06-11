package com.scriptkill.repository;

import com.scriptkill.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    List<Review> findBySessionId(Long sessionId);

    List<Review> findByScriptId(Long scriptId);

    List<Review> findByPlayerId(Long playerId);

    Page<Review> findByScriptId(Long scriptId, Pageable pageable);

    Optional<Review> findBySessionIdAndPlayerId(Long sessionId, Long playerId);

    @Query("SELECT AVG(r.scriptRating) FROM Review r WHERE r.script.id = :scriptId")
    Double calculateAverageScriptRating(Long scriptId);

    @Query("SELECT AVG(r.dmProfessionalism) FROM Review r WHERE r.session.dm.id = :dmId")
    Double calculateAverageDmRating(Long dmId);

    @Query("SELECT AVG(r.characterFit) FROM Review r WHERE r.character.id = :characterId")
    Double calculateAverageCharacterFit(Long characterId);

    boolean existsBySessionIdAndPlayerId(Long sessionId, Long playerId);
}
