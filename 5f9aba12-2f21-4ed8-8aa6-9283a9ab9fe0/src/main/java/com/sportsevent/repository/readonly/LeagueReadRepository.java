package com.sportsevent.repository.readonly;

import com.sportsevent.entity.League;
import com.sportsevent.repository.annotation.MongoTemplate;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@MongoTemplate(beanName = "secondaryMongoTemplate")
public interface LeagueReadRepository extends MongoRepository<League, String> {

    List<League> findByYear(Integer year);

    List<League> findBySportType(League.SportType sportType);

    List<League> findByStatus(League.LeagueStatus status);
}
