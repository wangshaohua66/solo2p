package com.sportsevent.repository;

import com.sportsevent.entity.Match;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MatchRepository extends MongoRepository<Match, String> {

    List<Match> findByLeagueId(String leagueId);

    List<Match> findByLeagueIdAndGroupName(String leagueId, String groupName);

    List<Match> findByLeagueIdAndStage(String leagueId, Match.StageType stage);

    @Query("{'leagueId': ?0, 'startTime': {$gte: ?1, $lte: ?2}}")
    List<Match> findByLeagueIdAndTimeRange(String leagueId, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{'venueId': ?0, 'courtNumber': ?1, 'startTime': {$lt: ?2}, 'endTime': {$gt: ?1}}")
    List<Match> findConflictingMatches(String venueId, Integer courtNumber, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{'$or': [{'teamAId': ?0}, {'teamBId': ?0}], 'startTime': {$lt: ?2}, 'endTime': {$gt: ?1}}")
    List<Match> findTeamConflictingMatches(String teamId, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{'refereeIds': ?0, 'startTime': {$lt: ?2}, 'endTime': {$gt: ?1}}")
    List<Match> findRefereeConflictingMatches(String refereeId, LocalDateTime startTime, LocalDateTime endTime);
}
