package com.sportsevent.repository;

import com.sportsevent.entity.League;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LeagueRepository extends MongoRepository<League, String> {

    @Query("{'year': ?0, 'sportType': ?1, 'category': ?2}")
    Optional<League> findByYearAndSportTypeAndCategory(Integer year, League.SportType sportType, String category);

    List<League> findByYear(Integer year);

    List<League> findBySportType(League.SportType sportType);

    List<League> findByStatus(League.LeagueStatus status);

    @Query("{'year': ?0, 'phase': {$in: ?1}}")
    List<League> findByYearAndPhaseIn(Integer year, List<League.SeasonPhase> phases);
}
