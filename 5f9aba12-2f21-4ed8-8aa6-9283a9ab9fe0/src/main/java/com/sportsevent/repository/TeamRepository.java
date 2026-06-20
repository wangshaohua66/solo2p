package com.sportsevent.repository;

import com.sportsevent.entity.Team;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamRepository extends MongoRepository<Team, String> {

    List<Team> findBySportType(com.sportsevent.entity.League.SportType sportType);

    List<Team> findBySportTypeAndCategory(com.sportsevent.entity.League.SportType sportType, String category);

    List<Team> findByStatus(Team.TeamStatus status);

    List<Team> findByIdIn(List<String> ids);
}
