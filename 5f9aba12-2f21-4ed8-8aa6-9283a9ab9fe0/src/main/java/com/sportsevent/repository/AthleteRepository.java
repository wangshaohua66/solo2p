package com.sportsevent.repository;

import com.sportsevent.entity.Athlete;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AthleteRepository extends MongoRepository<Athlete, String> {

    Optional<Athlete> findByIdCardNumber(String idCardNumber);

    List<Athlete> findByIdIn(List<String> ids);

    List<Athlete> findByOrganization(String organization);

    @Query("{'birthDate': {$gte: ?0, $lte: ?1}}")
    List<Athlete> findByBirthDateRange(LocalDate start, LocalDate end);

    @Query("{'status': ?0, 'suspensionRecords': {$elemMatch: {'status': 'ACTIVE', 'endDate': {$gte: ?1}}}}")
    List<Athlete> findCurrentlySuspended(Athlete.AthleteStatus status, LocalDate today);

    @Query("{'participationHistory': {$elemMatch: {'leagueId': ?0}}}")
    List<Athlete> findByLeagueParticipation(String leagueId);
}
