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
import java.util.*;
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

    @Value("${event.schedule.default-rest-minutes:120}")
    private int defaultRestMinutes;

    @Value("${event.schedule.max-matches-per-day:4}")
    private int maxMatchesPerDay;

    @Value("${event.schedule.multi-sport-buffer-minutes:180}")
    private int multiSportBufferMinutes;

    public ScheduleResult generateSchedule(String leagueId) {
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

        Map<String, List<Team>> groupTeamsMap = buildGroupTeamsMap(teams, approvedRegistrations);

        List<Match> allMatches = new ArrayList<>();
        List<Match.ConflictWarning> globalConflicts = new ArrayList<>();

        LocalDateTime scheduleStart = LocalDateTime.now().plusDays(7).withHour(9).withMinute(0);
        LocalDateTime scheduleEnd = scheduleStart.plusMonths(3);

        Map<String, TeamMatchSchedule> teamScheduleMap = new HashMap<>();
        for (Team team : teams) {
            teamScheduleMap.put(team.getId(), new TeamMatchSchedule());
        }

        Map<String, List<LocalDateTime>> athleteScheduleMap = buildAthleteScheduleMap(approvedRegistrations);

        int matchCount = 0;
        final int maxMatches = 200;

        for (Map.Entry<String, List<Team>> groupEntry : groupTeamsMap.entrySet()) {
            String groupName = groupEntry.getKey();
            List<Team> groupTeams = groupEntry.getValue();

            List<Match> groupMatches = generateRoundRobinMatches(
                    leagueId, groupName, groupTeams, scheduleStart, scheduleEnd,
                    venues, teamScheduleMap, athleteScheduleMap, globalConflicts);

            for (Match match : groupMatches) {
                if (matchCount < maxMatches) {
                    allMatches.add(match);
                    matchCount++;
                }
            }
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

    private Map<String, List<Team>> buildGroupTeamsMap(List<Team> teams,
                                                       List<Registration> registrations) {
        Map<String, List<Team>> groupMap = new LinkedHashMap<>();
        Map<String, Team> teamMap = teams.stream()
                .collect(Collectors.toMap(Team::getId, t -> t));

        int groupCount = (int) Math.ceil(Math.sqrt(teams.size()));
        if (groupCount < 1) groupCount = 1;
        if (groupCount > 8) groupCount = 8;

        for (int i = 0; i < groupCount; i++) {
            groupMap.put(String.valueOf((char) ('A' + i)), new ArrayList<>());
        }

        List<String> groupNames = new ArrayList<>(groupMap.keySet());
        int teamIndex = 0;
        for (Registration reg : registrations) {
            Team team = teamMap.get(reg.getTeamId());
            if (team != null) {
                String group = groupNames.get(teamIndex % groupNames.size());
                groupMap.get(group).add(team);
                teamIndex++;
            }
        }

        return groupMap;
    }

    private List<Match> generateRoundRobinMatches(String leagueId, String groupName,
                                                  List<Team> teams, LocalDateTime start, LocalDateTime end,
                                                  List<Venue> venues,
                                                  Map<String, TeamMatchSchedule> teamScheduleMap,
                                                  Map<String, List<LocalDateTime>> athleteScheduleMap,
                                                  List<Match.ConflictWarning> conflicts) {
        List<Match> matches = new ArrayList<>();
        int n = teams.size();
        if (n < 2) return matches;

        List<Team> teamsList = new ArrayList<>(teams);
        boolean hasBye = false;
        if (n % 2 != 0) {
            teamsList.add(null);
            n++;
            hasBye = true;
        }

        int totalRounds = n - 1;
        LocalDateTime currentDay = start;

        for (int round = 1; round <= totalRounds; round++) {
            for (int i = 0; i < n / 2; i++) {
                Team teamA = teamsList.get(i);
                Team teamB = teamsList.get(n - 1 - i);

                if (teamA == null || teamB == null) continue;

                Match match = findSlotAndCreateMatch(leagueId, groupName, round,
                        teamA, teamB, currentDay, end, venues,
                        teamScheduleMap, athleteScheduleMap, conflicts);
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
                                         List<Match.ConflictWarning> conflicts) {
        int matchDurationMinutes = 90;
        LocalDateTime currentDay = startDay;
        int daysTried = 0;
        final int maxDaysToTry = 30;

        while (currentDay.isBefore(end) && daysTried < maxDaysToTry) {
            if (currentDay.getDayOfWeek() != DayOfWeek.MONDAY) {
                for (Venue venue : venues) {
                    for (int court = 1; court <= venue.getTotalCourts(); court++) {
                        for (int hour = 9; hour < 20; hour += 2) {
                            LocalDateTime candidateStart = currentDay.withHour(hour).withMinute(0).withSecond(0);
                            LocalDateTime candidateEnd = candidateStart.plusMinutes(matchDurationMinutes);

                            if (isSlotValid(venue.getId(), court, candidateStart, candidateEnd,
                                    teamA.getId(), teamB.getId(), teamScheduleMap)) {

                                teamScheduleMap.computeIfAbsent(teamA.getId(), k -> new TeamMatchSchedule())
                                        .addMatch(candidateStart);
                                teamScheduleMap.computeIfAbsent(teamB.getId(), k -> new TeamMatchSchedule())
                                        .addMatch(candidateStart);

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

    private boolean isSlotValid(String venueId, int court, LocalDateTime start, LocalDateTime end,
                                String teamAId, String teamBId,
                                Map<String, TeamMatchSchedule> teamScheduleMap) {
        List<CourtBooking> venueConflicts = courtBookingRepository.findConflictingBookings(venueId, court, start, end);
        if (!venueConflicts.isEmpty()) return false;

        List<Match> existingCourtMatches = matchRepository.findConflictingMatches(venueId, court, start, end);
        if (!existingCourtMatches.isEmpty()) return false;

        if (!isTeamScheduleValid(teamAId, start, teamScheduleMap)) return false;
        if (!isTeamScheduleValid(teamBId, start, teamScheduleMap)) return false;

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

    @lombok.Data
    public static class ScheduleResult {
        private String leagueId;
        private boolean success;
        private String message;
        private int totalMatches;
        private List<Match> matches;
        private List<Match.ConflictWarning> conflicts;
    }

    @lombok.Data
    private static class TeamMatchSchedule {
        private List<LocalDateTime> matchTimes = new ArrayList<>();

        public void addMatch(LocalDateTime time) {
            matchTimes.add(time);
        }
    }
}
