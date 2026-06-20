package com.sportsevent.engine;

import com.sportsevent.entity.*;
import com.sportsevent.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class LeagueScheduler {

    private final MatchRepository matchRepository;
    private final CourtBookingRepository courtBookingRepository;
    private final RegistrationRepository registrationRepository;
    private final VenueRepository venueRepository;
    private final TeamRepository teamRepository;
    private final AthleteRepository athleteRepository;
    private final GroupDefinitionRepository groupDefinitionRepository;

    @Value("${event.schedule.default-rest-minutes:120}")
    private int defaultRestMinutes;

    @Value("${event.schedule.max-matches-per-day:4}")
    private int maxMatchesPerDay;

    @Value("${event.schedule.multi-sport-buffer-minutes:180}")
    private int multiSportBufferMinutes;

    @Value("${event.schedule.timeout-seconds:10}")
    private int scheduleTimeoutSeconds;

    public ScheduleResult generateSchedule(String leagueId) {
        ScheduleResult result = new ScheduleResult();
        result.setLeagueId(leagueId);

        ExecutorService executor = Executors.newSingleThreadExecutor();
        Future<ScheduleResult> future = executor.submit(() -> generateScheduleInternal(leagueId));

        try {
            ScheduleResult r = future.get(scheduleTimeoutSeconds, TimeUnit.SECONDS);
            return r;
        } catch (TimeoutException e) {
            future.cancel(true);
            result.setSuccess(false);
            result.setMessage("Schedule generation timed out after " + scheduleTimeoutSeconds + " seconds");
            log.warn("Schedule generation timeout for league {}", leagueId);
            return result;
        } catch (Exception e) {
            result.setSuccess(false);
            result.setMessage("Schedule generation failed: " + e.getMessage());
            log.error("Schedule generation error for league {}", leagueId, e);
            return result;
        } finally {
            executor.shutdownNow();
        }
    }

    private ScheduleResult generateScheduleInternal(String leagueId) {
        ScheduleResult result = new ScheduleResult();
        result.setLeagueId(leagueId);

        List<Registration> approvedRegistrations = registrationRepository.findByLeagueIdAndStatus(
                leagueId, Registration.RegistrationStatus.APPROVED);

        if (approvedRegistrations.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("No approved registrations found for league");
            return result;
        }

        List<String> teamIds = approvedRegistrations.stream()
                .map(Registration::getTeamId)
                .collect(Collectors.toList());
        List<Team> teams = teamRepository.findByIdIn(teamIds);

        List<Venue> venues = venueRepository.findByStatus(Venue.VenueStatus.ACTIVE);

        if (venues.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("No available venues configured");
            return result;
        }

        List<Athlete> athletes = new ArrayList<>();
        for (Registration reg : approvedRegistrations) {
            if (reg.getAthleteIds() != null && !reg.getAthleteIds().isEmpty()) {
                athletes.addAll(athleteRepository.findByIdIn(reg.getAthleteIds()));
            }
        }

        Map<String, List<Team>> groupTeamsMap = buildGroupTeamsMap(leagueId, teams,
                approvedRegistrations, athletes);

        List<Match> allMatches = new ArrayList<>();
        List<Match.ConflictWarning> globalConflicts = new ArrayList<>();

        LocalDateTime scheduleStart = LocalDateTime.now().plusDays(7).withHour(9).withMinute(0);
        LocalDateTime scheduleEnd = scheduleStart.plusMonths(3);

        Map<String, TeamMatchSchedule> teamScheduleMap = new HashMap<>();
        for (Team team : teams) {
            teamScheduleMap.put(team.getId(), new TeamMatchSchedule());
        }

        Map<String, List<LocalDateTime>> athleteScheduleMap = buildAthleteScheduleMap(approvedRegistrations);

        Map<String, List<Venue.TimeSlot>> venueTimeSlotMap = buildVenueTimeSlotMap(venues);

        for (Map.Entry<String, List<Team>> groupEntry : groupTeamsMap.entrySet()) {
            if (Thread.currentThread().isInterrupted()) break;

            String groupName = groupEntry.getKey();
            List<Team> groupTeams = groupEntry.getValue();

            List<Match> groupMatches = generateRoundRobinMatches(
                    leagueId, groupName, groupTeams, scheduleStart, scheduleEnd,
                    venues, teamScheduleMap, athleteScheduleMap, venueTimeSlotMap, globalConflicts);

            allMatches.addAll(groupMatches);
        }

        result.setMatches(allMatches);
        result.setTotalMatches(allMatches.size());
        result.setConflicts(globalConflicts);
        result.setSuccess(globalConflicts.stream()
                .noneMatch(c -> c.getType() == Match.ConflictWarning.ConflictType.VENUE_CONFLICT
                        || c.getType() == Match.ConflictWarning.ConflictType.TEAM_CONFLICT));
        result.setMessage(result.isSuccess()
                ? "Schedule generated successfully with " + allMatches.size() + " matches"
                : "Schedule generated with " + globalConflicts.size() + " conflict warnings");

        log.info("Schedule generation complete for league {}: {} matches, {} conflicts",
                leagueId, allMatches.size(), globalConflicts.size());

        return result;
    }

    private Map<String, List<Team>> buildGroupTeamsMap(String leagueId, List<Team> teams,
                                                       List<Registration> registrations,
                                                       List<Athlete> athletes) {
        Map<String, List<Team>> groupMap = new LinkedHashMap<>();
        Map<String, Team> teamMap = teams.stream()
                .collect(Collectors.toMap(Team::getId, t -> t));
        Map<String, Athlete> athleteMap = athletes.stream()
                .collect(Collectors.toMap(Athlete::getId, a -> a));

        List<GroupDefinition> groupDefs = groupDefinitionRepository.findByLeagueIdOrderByDisplayOrderAsc(leagueId);

        if (groupDefs.isEmpty()) {
            int groupCount = (int) Math.ceil(Math.sqrt(teams.size()));
            groupCount = Math.max(1, Math.min(groupCount, 8));
            for (int i = 0; i < groupCount; i++) {
                groupMap.put(String.valueOf((char) ('A' + i)), new ArrayList<>());
            }
        } else {
            for (GroupDefinition gd : groupDefs) {
                groupMap.put(gd.getName(), new ArrayList<>());
            }
        }

        List<String> groupNames = new ArrayList<>(groupMap.keySet());

        if (!groupDefs.isEmpty()) {
            for (Registration reg : registrations) {
                Team team = teamMap.get(reg.getTeamId());
                if (team == null) continue;

                String assignedGroup = findBestMatchingGroup(reg, team, athletes, groupDefs, athleteMap);
                if (assignedGroup == null) {
                    assignedGroup = groupNames.get(0);
                }
                groupMap.get(assignedGroup).add(team);
            }
        } else {
            int teamIndex = 0;
            for (Registration reg : registrations) {
                Team team = teamMap.get(reg.getTeamId());
                if (team != null) {
                    String group = groupNames.get(teamIndex % groupNames.size());
                    groupMap.get(group).add(team);
                    teamIndex++;
                }
            }
        }

        return groupMap;
    }

    private String findBestMatchingGroup(Registration reg, Team team,
                                          List<Athlete> athletes,
                                          List<GroupDefinition> groupDefs,
                                          Map<String, Athlete> athleteMap) {
        if (reg.getAthleteIds() == null || reg.getAthleteIds().isEmpty()) {
            return groupDefs.isEmpty() ? null : groupDefs.get(0).getName();
        }

        for (GroupDefinition gd : groupDefs) {
            boolean matches = true;

            if (gd.getCategory() != null && reg.getCategory() != null
                    && !gd.getCategory().equals(reg.getCategory())) {
                matches = false;
            }

            if (matches && gd.getAgeRange() != null) {
                for (String athleteId : reg.getAthleteIds()) {
                    Athlete athlete = athleteMap.get(athleteId);
                    if (athlete != null && athlete.getBirthDate() != null) {
                        int age = java.time.Period.between(athlete.getBirthDate(),
                                LocalDate.now()).getYears();
                        if (gd.getAgeRange().getMinAge() != null
                                && age < gd.getAgeRange().getMinAge()) {
                            matches = false;
                            break;
                        }
                        if (gd.getAgeRange().getMaxAge() != null
                                && age > gd.getAgeRange().getMaxAge()) {
                            matches = false;
                            break;
                        }
                    }
                }
            }

            if (matches) {
                if (gd.getMaxTeams() == null || groupDefs.size() < gd.getMaxTeams()) {
                    return gd.getName();
                }
            }
        }

        return groupDefs.isEmpty() ? null : groupDefs.get(0).getName();
    }

    private Map<String, List<Venue.TimeSlot>> buildVenueTimeSlotMap(List<Venue> venues) {
        Map<String, List<Venue.TimeSlot>> map = new HashMap<>();
        for (Venue venue : venues) {
            if (venue.getAvailableTimeSlots() != null && !venue.getAvailableTimeSlots().isEmpty()) {
                map.put(venue.getId(), venue.getAvailableTimeSlots());
            }
        }
        return map;
    }

    private boolean isVenueAvailableAt(Venue venue, LocalDateTime dateTime,
                                        Map<String, List<Venue.TimeSlot>> venueTimeSlotMap) {
        List<Venue.TimeSlot> slots = venueTimeSlotMap.get(venue.getId());
        if (slots == null || slots.isEmpty()) {
            return true;
        }

        DayOfWeek dayOfWeek = dateTime.getDayOfWeek();
        LocalTime time = dateTime.toLocalTime();

        for (Venue.TimeSlot slot : slots) {
            if (slotMatchesDay(slot, dayOfWeek)) {
                if (slot.getStartTime() != null && slot.getEndTime() != null) {
                    LocalTime slotStart = slot.getStartTime().toLocalTime();
                    LocalTime slotEnd = slot.getEndTime().toLocalTime();
                    if (!time.isBefore(slotStart) && !time.isAfter(slotEnd)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private boolean slotMatchesDay(Venue.TimeSlot slot, DayOfWeek dayOfWeek) {
        if (slot.getDayOfWeek() == null || slot.getDayOfWeek().equalsIgnoreCase("ALL")) {
            return true;
        }
        try {
            return DayOfWeek.valueOf(slot.getDayOfWeek().toUpperCase()) == dayOfWeek;
        } catch (Exception e) {
            return true;
        }
    }

    private List<Match> generateRoundRobinMatches(String leagueId, String groupName,
                                                  List<Team> teams, LocalDateTime start, LocalDateTime end,
                                                  List<Venue> venues,
                                                  Map<String, TeamMatchSchedule> teamScheduleMap,
                                                  Map<String, List<LocalDateTime>> athleteScheduleMap,
                                                  Map<String, List<Venue.TimeSlot>> venueTimeSlotMap,
                                                  List<Match.ConflictWarning> conflicts) {
        List<Match> matches = new ArrayList<>();
        int n = teams.size();
        if (n < 2) return matches;

        List<Team> teamsList = new ArrayList<>(teams);
        if (n % 2 != 0) {
            teamsList.add(null);
            n++;
        }

        int totalRounds = n - 1;
        LocalDateTime currentDay = start;

        for (int round = 1; round <= totalRounds; round++) {
            if (Thread.currentThread().isInterrupted()) break;

            for (int i = 0; i < n / 2; i++) {
                Team teamA = teamsList.get(i);
                Team teamB = teamsList.get(n - 1 - i);

                if (teamA == null || teamB == null) continue;

                Match match = findSlotAndCreateMatch(leagueId, groupName, round,
                        teamA, teamB, currentDay, end, venues,
                        teamScheduleMap, athleteScheduleMap, venueTimeSlotMap, conflicts);
                if (match != null) {
                    matches.add(match);
                }
            }
            Collections.rotate(teamsList.subList(1, n), 1);
            currentDay = currentDay.plusDays(1).withHour(9).withMinute(0);
        }

        return matches;
    }

    private Match findSlotAndCreateMatch(String leagueId, String groupName, int round,
                                         Team teamA, Team teamB, LocalDateTime startDay, LocalDateTime end,
                                         List<Venue> venues,
                                         Map<String, TeamMatchSchedule> teamScheduleMap,
                                         Map<String, List<LocalDateTime>> athleteScheduleMap,
                                         Map<String, List<Venue.TimeSlot>> venueTimeSlotMap,
                                         List<Match.ConflictWarning> conflicts) {
        int matchDurationMinutes = 90;
        LocalDateTime currentDay = startDay;
        int daysTried = 0;
        final int maxDaysToTry = 60;

        while (currentDay.isBefore(end) && daysTried < maxDaysToTry) {
            if (Thread.currentThread().isInterrupted()) break;

            for (Venue venue : venues) {
                if (!isVenueAvailableAt(venue, currentDay.withHour(9).withMinute(0), venueTimeSlotMap)) {
                    continue;
                }

                for (int court = 1; court <= (venue.getTotalCourts() != null ? venue.getTotalCourts() : 1); court++) {
                    for (int hour = 9; hour < 20; hour += 2) {
                        LocalDateTime candidateStart = currentDay.withHour(hour).withMinute(0).withSecond(0);
                        LocalDateTime candidateEnd = candidateStart.plusMinutes(matchDurationMinutes);

                        if (!isVenueAvailableAt(venue, candidateStart, venueTimeSlotMap)) {
                            continue;
                        }

                        List<String> teamAAthleteIds = getTeamAthleteIds(teamA.getId(),
                                registrationRepository.findByLeagueIdAndTeamId(leagueId, teamA.getId()).orElse(null));
                        List<String> teamBAthleteIds = getTeamAthleteIds(teamB.getId(),
                                registrationRepository.findByLeagueIdAndTeamId(leagueId, teamB.getId()).orElse(null));

                        if (isSlotValid(venue.getId(), court, candidateStart, candidateEnd,
                                teamA.getId(), teamB.getId(),
                                teamAAthleteIds, teamBAthleteIds,
                                teamScheduleMap, athleteScheduleMap)) {

                            teamScheduleMap.computeIfAbsent(teamA.getId(), k -> new TeamMatchSchedule())
                                    .addMatch(candidateStart);
                            teamScheduleMap.computeIfAbsent(teamB.getId(), k -> new TeamMatchSchedule())
                                    .addMatch(candidateStart);

                            updateAthleteSchedule(teamAAthleteIds, candidateStart, athleteScheduleMap);
                            updateAthleteSchedule(teamBAthleteIds, candidateStart, athleteScheduleMap);

                            Match match = new Match();
                            match.setLeagueId(leagueId);
                            match.setGroupName(groupName);
                            match.setStage(Match.StageType.GROUP_STAGE);
                            match.setRound(round);
                            match.setTeamAId(teamA.getId());
                            match.setTeamBId(teamB.getId());
                            match.setVenueId(venue.getId());
                            match.setCourtNumber(court);
                            match.setStartTime(candidateStart);
                            match.setEndTime(candidateEnd);
                            match.setStatus(Match.MatchStatus.SCHEDULED);
                            match.setRestMinutesBefore(defaultRestMinutes);
                            match.setCreatedAt(LocalDateTime.now());
                            match.setUpdatedAt(LocalDateTime.now());
                            return match;
                        }
                    }
                }
            }
            currentDay = currentDay.plusDays(1).withHour(9).withMinute(0);
            daysTried++;
        }

        Match.ConflictWarning warning = new Match.ConflictWarning();
        warning.setType(Match.ConflictWarning.ConflictType.TEAM_CONFLICT);
        warning.setDescription("No valid time slot found for match between " + teamA.getName() + " and " + teamB.getName());
        warning.setRelatedEntityId(teamA.getId() + "-" + teamB.getId());
        conflicts.add(warning);

        return null;
    }

    private List<String> getTeamAthleteIds(String teamId, Registration registration) {
        if (registration != null && registration.getAthleteIds() != null) {
            return registration.getAthleteIds();
        }
        return Collections.emptyList();
    }

    private void updateAthleteSchedule(List<String> athleteIds, LocalDateTime time,
                                        Map<String, List<LocalDateTime>> athleteScheduleMap) {
        if (athleteIds == null) return;
        for (String athleteId : athleteIds) {
            athleteScheduleMap.computeIfAbsent(athleteId, k -> new ArrayList<>()).add(time);
        }
    }

    private boolean isSlotValid(String venueId, int court, LocalDateTime start, LocalDateTime end,
                                String teamAId, String teamBId,
                                List<String> teamAAthleteIds, List<String> teamBAthleteIds,
                                Map<String, TeamMatchSchedule> teamScheduleMap,
                                Map<String, List<LocalDateTime>> athleteScheduleMap) {
        List<CourtBooking> venueConflicts = courtBookingRepository.findConflictingBookings(venueId, court, start, end);
        if (!venueConflicts.isEmpty()) return false;

        List<Match> existingCourtMatches = matchRepository.findConflictingMatches(venueId, court, start, end);
        if (!existingCourtMatches.isEmpty()) return false;

        if (!isTeamScheduleValid(teamAId, start, teamScheduleMap)) return false;
        if (!isTeamScheduleValid(teamBId, start, teamScheduleMap)) return false;

        if (!isAthleteMultiSportValid(teamAAthleteIds, start, athleteScheduleMap)) return false;
        if (!isAthleteMultiSportValid(teamBAthleteIds, start, athleteScheduleMap)) return false;

        return true;
    }

    private boolean isTeamScheduleValid(String teamId, LocalDateTime candidateStart,
                                        Map<String, TeamMatchSchedule> teamScheduleMap) {
        TeamMatchSchedule schedule = teamScheduleMap.get(teamId);
        if (schedule == null || schedule.getMatchTimes().isEmpty()) return true;

        LocalDate candidateDate = candidateStart.toLocalDate();
        long matchesOnDay = schedule.getMatchTimes().stream()
                .filter(t -> t.toLocalDate().equals(candidateDate))
                .count();
        if (matchesOnDay >= maxMatchesPerDay) return false;

        for (LocalDateTime existingTime : schedule.getMatchTimes()) {
            long minutesDiff = Math.abs(Duration.between(existingTime, candidateStart).toMinutes());
            if (minutesDiff < defaultRestMinutes) return false;
        }

        return true;
    }

    private boolean isAthleteMultiSportValid(List<String> athleteIds, LocalDateTime candidateStart,
                                             Map<String, List<LocalDateTime>> athleteScheduleMap) {
        if (athleteIds == null || athleteIds.isEmpty()) return true;

        for (String athleteId : athleteIds) {
            List<LocalDateTime> existingTimes = athleteScheduleMap.get(athleteId);
            if (existingTimes != null && !existingTimes.isEmpty()) {
                for (LocalDateTime existingTime : existingTimes) {
                    long minutesDiff = Math.abs(Duration.between(existingTime, candidateStart).toMinutes());
                    if (minutesDiff < multiSportBufferMinutes) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private Map<String, List<LocalDateTime>> buildAthleteScheduleMap(List<Registration> registrations) {
        Map<String, List<LocalDateTime>> athleteMap = new HashMap<>();

        Set<String> allAthleteIds = new HashSet<>();
        for (Registration reg : registrations) {
            if (reg.getAthleteIds() != null) {
                allAthleteIds.addAll(reg.getAthleteIds());
            }
        }

        for (String athleteId : allAthleteIds) {
            List<Registration> allRegs = registrationRepository.findApprovedByAthleteId(athleteId);
            for (Registration reg : allRegs) {
                List<Match> matches = matchRepository.findByLeagueId(reg.getLeagueId());
                for (Match match : matches) {
                    if (match.getStartTime() != null) {
                        athleteMap.computeIfAbsent(athleteId, k -> new ArrayList<>())
                                .add(match.getStartTime());
                    }
                }
            }
        }

        return athleteMap;
    }

    public List<Match.ConflictWarning> validateMatchConflicts(Match match) {
        List<Match.ConflictWarning> conflicts = new ArrayList<>();

        if (match.getVenueId() != null && match.getCourtNumber() != null) {
            List<Match> venueConflicts = matchRepository.findConflictingMatches(
                    match.getVenueId(), match.getCourtNumber(), match.getStartTime(), match.getEndTime());
            venueConflicts.stream()
                    .filter(m -> !m.getId().equals(match.getId()))
                    .forEach(m -> {
                        Match.ConflictWarning w = new Match.ConflictWarning();
                        w.setType(Match.ConflictWarning.ConflictType.VENUE_CONFLICT);
                        w.setDescription("Court conflict with match: " + m.getId());
                        w.setRelatedEntityId(m.getId());
                        conflicts.add(w);
                    });
        }

        if (match.getTeamAId() != null) {
            List<Match> teamAConflicts = matchRepository.findTeamConflictingMatches(
                    match.getTeamAId(), match.getStartTime(), match.getEndTime());
            teamAConflicts.stream()
                    .filter(m -> !m.getId().equals(match.getId()))
                    .forEach(m -> {
                        Match.ConflictWarning w = new Match.ConflictWarning();
                        w.setType(Match.ConflictWarning.ConflictType.TEAM_CONFLICT);
                        w.setDescription("Team A conflict with match: " + m.getId());
                        w.setRelatedEntityId(m.getId());
                        conflicts.add(w);
                    });
        }

        if (match.getTeamBId() != null) {
            List<Match> teamBConflicts = matchRepository.findTeamConflictingMatches(
                    match.getTeamBId(), match.getStartTime(), match.getEndTime());
            teamBConflicts.stream()
                    .filter(m -> !m.getId().equals(match.getId()))
                    .forEach(m -> {
                        Match.ConflictWarning w = new Match.ConflictWarning();
                        w.setType(Match.ConflictWarning.ConflictType.TEAM_CONFLICT);
                        w.setDescription("Team B conflict with match: " + m.getId());
                        w.setRelatedEntityId(m.getId());
                        conflicts.add(w);
                    });
        }

        if (match.getRefereeIds() != null) {
            for (String refereeId : match.getRefereeIds()) {
                List<Match> refConflicts = matchRepository.findRefereeConflictingMatches(
                        refereeId, match.getStartTime(), match.getEndTime());
                refConflicts.stream()
                        .filter(m -> !m.getId().equals(match.getId()))
                        .forEach(m -> {
                            Match.ConflictWarning w = new Match.ConflictWarning();
                            w.setType(Match.ConflictWarning.ConflictType.REFEREE_CONFLICT);
                            w.setDescription("Referee " + refereeId + " conflict with match: " + m.getId());
                            w.setRelatedEntityId(refereeId);
                            conflicts.add(w);
                        });
            }
        }

        return conflicts;
    }

    public List<Match.ConflictWarning> detectAthleteMultiSportConflicts(Match match,
                                                                         List<String> athleteIds) {
        List<Match.ConflictWarning> conflicts = new ArrayList<>();

        if (athleteIds == null || athleteIds.isEmpty()) return conflicts;

        for (String athleteId : athleteIds) {
            List<Registration> allRegs = registrationRepository.findApprovedByAthleteId(athleteId);
            for (Registration reg : allRegs) {
                if (reg.getLeagueId().equals(match.getLeagueId())) continue;

                List<Match> matches = matchRepository.findByLeagueId(reg.getLeagueId());
                for (Match m : matches) {
                    if (m.getStartTime() == null || m.getId().equals(match.getId())) continue;

                    long minutesDiff = Math.abs(Duration.between(m.getStartTime(), match.getStartTime()).toMinutes());
                    if (minutesDiff < multiSportBufferMinutes) {
                        Match.ConflictWarning w = new Match.ConflictWarning();
                        w.setType(Match.ConflictWarning.ConflictType.ATHLETE_MULTISPORT_CONFLICT);
                        w.setDescription("Athlete " + athleteId + " has multi-sport conflict with match " + m.getId());
                        w.setRelatedEntityId(athleteId);
                        conflicts.add(w);
                    }
                }
            }
        }

        return conflicts;
    }

    @lombok.Data
    public static class ScheduleResult {
        private String leagueId;
        private boolean success;
        private String message;
        private int totalMatches;
        private List<Match> matches;
        private List<Match.ConflictWarning> conflicts;
        private long durationMs;
    }

    @lombok.Data
    private static class TeamMatchSchedule {
        private List<LocalDateTime> matchTimes = new ArrayList<>();

        public void addMatch(LocalDateTime time) {
            matchTimes.add(time);
        }
    }
}
