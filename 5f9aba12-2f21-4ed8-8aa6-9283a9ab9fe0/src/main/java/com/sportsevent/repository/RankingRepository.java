package com.sportsevent.repository;

import com.sportsevent.entity.Ranking;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RankingRepository extends MongoRepository<Ranking, String> {

    List<Ranking> findByLeagueId(String leagueId);

    List<Ranking> findByLeagueIdAndGroupName(String leagueId, String groupName);

    Optional<Ranking> findByLeagueIdAndGroupNameAndTeamId(String leagueId, String groupName, String teamId);

    @Query("{'leagueId': ?0, 'groupName': ?1}")
    List<Ranking> findByLeagueAndGroupOrderByPointsDesc(String leagueId, String groupName);
}
