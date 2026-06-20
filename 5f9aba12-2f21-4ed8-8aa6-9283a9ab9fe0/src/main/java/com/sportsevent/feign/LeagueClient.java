package com.sportsevent.feign;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Match;
import com.sportsevent.engine.LeagueScheduler;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@FeignClient(name = "sports-event-service", path = "/api/leagues")
public interface LeagueClient {

    @GetMapping("/{id}")
    ApiResponse<League> getLeague(@PathVariable("id") String id);

    @PostMapping("/{leagueId}/schedule/generate")
    ApiResponse<LeagueScheduler.ScheduleResult> generateSchedule(@PathVariable("leagueId") String leagueId);

    @GetMapping("/{leagueId}/matches")
    ApiResponse<List<Match>> listLeagueMatches(
            @PathVariable("leagueId") String leagueId,
            @RequestParam(value = "groupName", required = false) String groupName,
            @RequestParam(value = "stage", required = false) Match.StageType stage);
}
