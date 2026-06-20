package com.sportsevent.repository;

import com.sportsevent.entity.Score;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ScoreRepository extends MongoRepository<Score, String> {

    Optional<Score> findByMatchId(String matchId);

    List<Score> findByLeagueId(String leagueId);

    List<Score> findByLeagueIdAndStatus(String leagueId, Score.ScoreStatus status);

    List<Score> findByTeamAIdOrTeamBId(String teamAId, String teamBId);

    List<Score> findByAthleteId(String athleteId);
}
