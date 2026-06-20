package com.sportsevent.repository;

import com.sportsevent.entity.KnockoutBracket;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KnockoutBracketRepository extends MongoRepository<KnockoutBracket, String> {

    List<KnockoutBracket> findByLeagueId(String leagueId);

    Optional<KnockoutBracket> findByLeagueIdAndStage(String leagueId, com.sportsevent.entity.Match.StageType stage);
}
