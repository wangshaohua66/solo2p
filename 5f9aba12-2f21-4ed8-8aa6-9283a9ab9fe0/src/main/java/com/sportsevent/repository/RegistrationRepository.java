package com.sportsevent.repository;

import com.sportsevent.entity.Registration;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RegistrationRepository extends MongoRepository<Registration, String> {

    Optional<Registration> findByLeagueIdAndTeamId(String leagueId, String teamId);

    List<Registration> findByLeagueId(String leagueId);

    List<Registration> findByLeagueIdAndStatus(String leagueId, Registration.RegistrationStatus status);

    @Query("{'athleteIds': ?0, 'status': 'APPROVED'}")
    List<Registration> findApprovedByAthleteId(String athleteId);

    @Query("{'athleteIds': ?0, 'leagueId': ?1}")
    List<Registration> findByAthleteIdAndLeagueId(String athleteId, String leagueId);

    @Query("{'leagueId': ?0, 'athleteIds': ?1, 'status': {$in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']}}")
    List<Registration> findActiveByLeagueIdAndAthleteId(String leagueId, String athleteId);

    @Query("{'athleteIds': ?0}")
    List<Registration> findByAthleteId(String athleteId);
}
