package com.sportsevent.repository;

import com.sportsevent.entity.Referee;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RefereeRepository extends MongoRepository<Referee, String> {

    List<Referee> findByStatus(Referee.RefereeStatus status);

    @Query("{'certifiedSports': ?0, 'status': 'ACTIVE'}")
    List<Referee> findActiveBySport(com.sportsevent.entity.League.SportType sport);

    @Query("{'certifiedSports': ?0, 'certifiedCategories': ?1, 'status': 'ACTIVE'}")
    List<Referee> findActiveBySportAndCategory(com.sportsevent.entity.League.SportType sport, String category);

    List<Referee> findByOrganization(String organization);

    List<Referee> findByIdIn(List<String> ids);
}
