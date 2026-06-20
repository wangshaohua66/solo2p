package com.sportsevent.feign;

import com.sportsevent.dto.ApiResponse;
import com.sportsevent.entity.Athlete;
import com.sportsevent.entity.Registration;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "sports-event-service", path = "/api/registrations")
public interface RegistrationClient {

    @GetMapping("/{id}")
    ApiResponse<Registration> getRegistration(@PathVariable("id") String id);

    @GetMapping
    ApiResponse<List<Registration>> listRegistrations(
            @RequestParam(value = "leagueId", required = false) String leagueId,
            @RequestParam(value = "status", required = false) Registration.RegistrationStatus status);

    @GetMapping("/athletes/{athleteId}/profile")
    ApiResponse<Athlete> getAthleteProfile(@PathVariable("athleteId") String athleteId);
}
