package com.sportsevent.engine;

import com.sportsevent.entity.Athlete;
import com.sportsevent.entity.League;
import com.sportsevent.entity.Registration;
import com.sportsevent.repository.AthleteRepository;
import com.sportsevent.repository.LeagueRepository;
import com.sportsevent.repository.RegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class EligibilityValidator {

    private final AthleteRepository athleteRepository;
    private final LeagueRepository leagueRepository;
    private final RegistrationRepository registrationRepository;

    @Value("${event.eligibility.max-multisport:3}")
    private int maxMultiSportPerSeason;

    public EligibilityResult validateRegistration(Registration registration) {
        EligibilityResult result = new EligibilityResult();
        result.setRegistrationId(registration.getId());
        result.setValid(true);

        Optional<League> leagueOpt = leagueRepository.findById(registration.getLeagueId());
        if (leagueOpt.isEmpty()) {
            result.addIssue(Registration.EligibilityIssue.IssueType.CATEGORY_MISMATCH,
                    null, "League not found: " + registration.getLeagueId(),
                    Registration.EligibilityIssue.IssueSeverity.ERROR);
            result.setValid(false);
            return result;
        }

        League league = leagueOpt.get();
        result.setLeagueId(league.getId());

        if (registration.getAthleteIds() == null || registration.getAthleteIds().isEmpty()) {
            result.addIssue(Registration.EligibilityIssue.IssueType.CATEGORY_MISMATCH,
                    null, "No athletes provided in registration",
                    Registration.EligibilityIssue.IssueSeverity.ERROR);
            result.setValid(false);
            return result;
        }

        List<Athlete> athletes = athleteRepository.findByIdIn(registration.getAthleteIds());
        Map<String, Athlete> athleteMap = athletes.stream()
                .collect(Collectors.toMap(Athlete::getId, a -> a));

        for (String athleteId : registration.getAthleteIds()) {
            Athlete athlete = athleteMap.get(athleteId);
            if (athlete == null) {
                result.addIssue(Registration.EligibilityIssue.IssueType.CATEGORY_MISMATCH,
                        athleteId, "Athlete not found: " + athleteId,
                        Registration.EligibilityIssue.IssueSeverity.ERROR);
                result.setValid(false);
                continue;
            }

            validateAgeCategory(athlete, registration.getCategory(), result);
            validateRegistrationExpiry(athlete, result);
            validateSuspensionStatus(athlete, league, result);
            validateMultiSportLimit(athlete, league, result);
        }

        result.setIssuesCount(result.getIssues().size());
        result.setErrorsCount((int) result.getIssues().stream()
                .filter(i -> i.getSeverity() == Registration.EligibilityIssue.IssueSeverity.ERROR)
                .count());
        result.setWarningsCount((int) result.getIssues().stream()
                .filter(i -> i.getSeverity() == Registration.EligibilityIssue.IssueSeverity.WARNING)
                .count());

        log.info("Eligibility validation for registration {}: valid={}, errors={}, warnings={}",
                registration.getId(), result.isValid(), result.getErrorsCount(), result.getWarningsCount());

        return result;
    }

    private void validateAgeCategory(Athlete athlete, String category, EligibilityResult result) {
        if (category == null || athlete.getBirthDate() == null) {
            return;
        }

        int age = Period.between(athlete.getBirthDate(), LocalDate.now()).getYears();
        AgeRange ageRange = parseCategoryAgeRange(category);

        if (ageRange != null) {
            if (age < ageRange.minAge || age > ageRange.maxAge) {
                result.addIssue(Registration.EligibilityIssue.IssueType.AGE_MISMATCH,
                        athlete.getId(),
                        String.format("Athlete age %d not in category range %d-%d for category '%s'",
                                age, ageRange.minAge, ageRange.maxAge, category),
                        Registration.EligibilityIssue.IssueSeverity.ERROR);
            }
        }
    }

    private AgeRange parseCategoryAgeRange(String category) {
        if (category == null) return null;

        category = category.toLowerCase();
        if (category.contains("u18") || category.contains("少年")) {
            return new AgeRange(0, 17);
        } else if (category.contains("u21") || category.contains("青年")) {
            return new AgeRange(18, 20);
        } else if (category.contains("senior") || category.contains("成年")) {
            return new AgeRange(18, 60);
        } else if (category.contains("veteran") || category.contains("老将") || category.contains("中年")) {
            return new AgeRange(35, 100);
        }
        return new AgeRange(16, 60);
    }

    private void validateRegistrationExpiry(Athlete athlete, EligibilityResult result) {
        if (athlete.getRegistrationExpiry() == null) {
            result.addIssue(Registration.EligibilityIssue.IssueType.REGISTRATION_EXPIRED,
                    athlete.getId(), "Athlete registration expiry date not set",
                    Registration.EligibilityIssue.IssueSeverity.WARNING);
            return;
        }

        if (athlete.getRegistrationExpiry().isBefore(LocalDate.now())) {
            result.addIssue(Registration.EligibilityIssue.IssueType.REGISTRATION_EXPIRED,
                    athlete.getId(),
                    String.format("Athlete registration expired on %s", athlete.getRegistrationExpiry()),
                    Registration.EligibilityIssue.IssueSeverity.ERROR);
        }
    }

    private void validateSuspensionStatus(Athlete athlete, League league, EligibilityResult result) {
        if (athlete.getStatus() == Athlete.AthleteStatus.SUSPENDED) {
            result.addIssue(Registration.EligibilityIssue.IssueType.SUSPENDED,
                    athlete.getId(), "Athlete account is currently suspended",
                    Registration.EligibilityIssue.IssueSeverity.ERROR);
        }

        if (athlete.getSuspensionRecords() != null) {
            LocalDate today = LocalDate.now();
            for (Athlete.SuspensionRecord record : athlete.getSuspensionRecords()) {
                if (record.getStatus() == Athlete.SuspensionRecord.SuspensionStatus.ACTIVE) {
                    boolean activeSuspension = !record.getEndDate().isBefore(today);
                    if (activeSuspension) {
                        if (record.getLeagueId() == null || record.getLeagueId().equals(league.getId())) {
                            result.addIssue(Registration.EligibilityIssue.IssueType.SUSPENDED,
                                    athlete.getId(),
                                    String.format("Athlete is suspended until %s. Reason: %s",
                                            record.getEndDate(), record.getReason()),
                                    Registration.EligibilityIssue.IssueSeverity.ERROR);
                        }
                    }
                }
            }
        }
    }

    private void validateMultiSportLimit(Athlete athlete, League league, EligibilityResult result) {
        List<Registration> approvedRegs = registrationRepository.findApprovedByAthleteId(athlete.getId());

        Set<String> uniqueLeagueIds = new HashSet<>();
        for (Registration reg : approvedRegs) {
            if (!reg.getLeagueId().equals(league.getId())) {
                uniqueLeagueIds.add(reg.getLeagueId());
            }
        }

        int multisportCount = 0;
        for (String leagueId : uniqueLeagueIds) {
            Optional<League> l = leagueRepository.findById(leagueId);
            if (l.isPresent() && l.get().getYear().equals(league.getYear())) {
                multisportCount++;
            }
        }

        if (multisportCount >= maxMultiSportPerSeason) {
            result.addIssue(Registration.EligibilityIssue.IssueType.MULTISPORT_LIMIT_EXCEEDED,
                    athlete.getId(),
                    String.format("Athlete has registered for %d leagues this season, exceeding limit of %d",
                            multisportCount, maxMultiSportPerSeason),
                    Registration.EligibilityIssue.IssueSeverity.WARNING);
        }
    }

    public List<Registration.MultiSportConflict> detectMultiSportConflicts(
            String athleteId, LocalDateTime startTime, LocalDateTime endTime) {
        List<Registration.MultiSportConflict> conflicts = new ArrayList<>();

        List<Registration> allRegs = registrationRepository.findApprovedByAthleteId(athleteId);
        Set<String> leagueIds = allRegs.stream()
                .map(Registration::getLeagueId)
                .collect(Collectors.toSet());

        return conflicts;
    }

    @lombok.Data
    public static class EligibilityResult {
        private String registrationId;
        private String leagueId;
        private boolean valid;
        private List<Registration.EligibilityIssue> issues = new ArrayList<>();
        private int issuesCount;
        private int errorsCount;
        private int warningsCount;

        public void addIssue(Registration.EligibilityIssue.IssueType type, String athleteId,
                             String description, Registration.EligibilityIssue.IssueSeverity severity) {
            Registration.EligibilityIssue issue = new Registration.EligibilityIssue();
            issue.setType(type);
            issue.setAthleteId(athleteId);
            issue.setDescription(description);
            issue.setSeverity(severity);
            this.issues.add(issue);
            if (severity == Registration.EligibilityIssue.IssueSeverity.ERROR) {
                this.valid = false;
            }
        }
    }

    @lombok.AllArgsConstructor
    private static class AgeRange {
        int minAge;
        int maxAge;
    }
}
