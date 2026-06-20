package com.sportsevent.repository.readonly;

import com.sportsevent.entity.Match;
import com.sportsevent.repository.annotation.MongoTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
@MongoTemplate(beanName = "secondaryMongoTemplate")
public interface MatchReadRepository extends MongoRepository<Match, String> {

    List<Match> findByLeagueId(String leagueId);

    List<Match> findByLeagueIdAndGroupName(String leagueId, String groupName);

    List<Match> findByLeagueIdAndStage(String leagueId, Match.StageType stage);

    @Query("{'venueId': ?0, 'courtNumber': ?1, 'startTime': {$lt: ?3}, 'endTime': {$gt: ?2}}")
    List<Match> findConflictingMatches(String venueId, Integer courtNumber, LocalDateTime startTime, LocalDateTime endTime);

    @Query("{'refereeIds': ?0, 'startTime': {$lt: ?2}, 'endTime': {$gt: ?1}}")
    List<Match> findRefereeConflictingMatches(String refereeId, LocalDateTime startTime, LocalDateTime endTime);
}
