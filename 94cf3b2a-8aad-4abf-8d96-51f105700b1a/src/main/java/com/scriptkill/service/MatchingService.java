package com.scriptkill.service;

import com.scriptkill.dto.matching.CharacterAssignment;
import com.scriptkill.dto.matching.MatchingPlan;
import com.scriptkill.dto.matching.MatchingScoreDetail;
import com.scriptkill.entity.GameSession;
import com.scriptkill.entity.PlayerProfile;
import com.scriptkill.entity.ScriptCharacter;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.ScriptGenre;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.ScriptCharacterRepository;
import com.scriptkill.repository.SessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class MatchingService {

    private final SessionRepository sessionRepository;
    private final ScriptCharacterRepository characterRepository;
    private final PlayerService playerService;
    private final BookingService bookingService;

    private static final double WEIGHT_HISTORY = 0.25;
    private static final double WEIGHT_AGE = 0.15;
    private static final double WEIGHT_GENDER = 0.15;
    private static final double WEIGHT_HORROR = 0.15;
    private static final double WEIGHT_EMOTIONAL = 0.15;
    private static final double WEIGHT_SOCIAL = 0.15;

    public MatchingService(SessionRepository sessionRepository,
                           ScriptCharacterRepository characterRepository,
                           PlayerService playerService,
                           BookingService bookingService) {
        this.sessionRepository = sessionRepository;
        this.characterRepository = characterRepository;
        this.playerService = playerService;
        this.bookingService = bookingService;
    }

    @Transactional(readOnly = true)
    public List<MatchingPlan> generateTop3Plans(Long sessionId, List<Long> candidatePlayerIds) {
        GameSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException("会话不存在"));

        int neededPlayers = session.getMaxPlayers() -
                (int) bookingService.getConfirmedBookingCount(sessionId);

        if (candidatePlayerIds.size() < neededPlayers) {
            throw new BusinessException("候选玩家数量不足");
        }

        List<PlayerProfile> candidates = candidatePlayerIds.stream()
                .map(playerService::getPlayerProfileEntity)
                .collect(Collectors.toList());

        List<List<PlayerProfile>> combinations = generateCombinations(candidates, neededPlayers);

        List<MatchingPlan> plans = new ArrayList<>();
        for (List<PlayerProfile> combo : combinations) {
            MatchingPlan plan = calculateMatchingScore(combo, session);
            plans.add(plan);
        }

        plans.sort((p1, p2) -> Double.compare(p2.getTotalScore(), p1.getTotalScore()));

        List<MatchingPlan> top3 = plans.stream().limit(3).collect(Collectors.toList());
        for (int i = 0; i < top3.size(); i++) {
            top3.get(i).setRank(i + 1);
        }

        return top3;
    }

    private List<List<PlayerProfile>> generateCombinations(List<PlayerProfile> candidates, int k) {
        List<List<PlayerProfile>> result = new ArrayList<>();
        generateCombinationsHelper(candidates, k, 0, new ArrayList<>(), result);
        return result;
    }

    private void generateCombinationsHelper(List<PlayerProfile> candidates, int k,
                                            int start, List<PlayerProfile> current,
                                            List<List<PlayerProfile>> result) {
        if (current.size() == k) {
            result.add(new ArrayList<>(current));
            return;
        }
        for (int i = start; i < candidates.size(); i++) {
            current.add(candidates.get(i));
            generateCombinationsHelper(candidates, k, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }

    private MatchingPlan calculateMatchingScore(List<PlayerProfile> players, GameSession session) {
        MatchingPlan plan = new MatchingPlan();

        List<Long> playerIds = players.stream().map(p -> p.getUser().getId()).collect(Collectors.toList());
        List<String> playerNames = players.stream().map(p -> p.getUser().getNickname()).collect(Collectors.toList());
        plan.setPlayerIds(playerIds);
        plan.setPlayerNames(playerNames);

        MatchingScoreDetail detail = new MatchingScoreDetail();

        double historyScore = calculateHistoryPreferenceScore(players, session);
        detail.setHistoryPreferenceScore(historyScore);

        double ageScore = calculateAgeGroupScore(players);
        detail.setAgeGroupScore(ageScore);

        double genderScore = calculateGenderRatioScore(players, session);
        detail.setGenderRatioScore(genderScore);

        double horrorScore = calculateHorrorTagScore(players, session);
        detail.setHorrorTagScore(horrorScore);

        double emotionalScore = calculateEmotionalTagScore(players, session);
        detail.setEmotionalTagScore(emotionalScore);

        double socialScore = calculateSocialScore(players);
        detail.setSocialScore(socialScore);

        double reasoningScore = calculateReasoningScore(players, session);
        detail.setReasoningScore(reasoningScore);

        double totalScore = historyScore * WEIGHT_HISTORY +
                ageScore * WEIGHT_AGE +
                genderScore * WEIGHT_GENDER +
                horrorScore * WEIGHT_HORROR +
                emotionalScore * WEIGHT_EMOTIONAL +
                socialScore * WEIGHT_SOCIAL +
                reasoningScore * 0.1;

        totalScore = Math.round(totalScore * 100.0) / 100.0;

        plan.setScoreDetail(detail);
        plan.setTotalScore(totalScore);

        List<CharacterAssignment> assignments = suggestCharacterAssignments(players, session);
        plan.setCharacterAssignments(assignments);

        return plan;
    }

    private double calculateHistoryPreferenceScore(List<PlayerProfile> players, GameSession session) {
        ScriptGenre scriptGenre = session.getScript().getGenre();
        int matchCount = 0;

        for (PlayerProfile player : players) {
            String preferred = player.getPreferredGenre();
            if (preferred != null && preferred.contains(scriptGenre.name())) {
                matchCount++;
            }
        }

        return (double) matchCount / players.size() * 100;
    }

    private double calculateAgeGroupScore(List<PlayerProfile> players) {
        Map<String, Integer> ageGroupCount = new HashMap<>();
        for (PlayerProfile player : players) {
            String ageGroup = player.getAgeGroup() != null ? player.getAgeGroup() : "UNKNOWN";
            ageGroupCount.merge(ageGroup, 1, Integer::sum);
        }

        int maxGroupCount = ageGroupCount.values().stream()
                .max(Integer::compareTo).orElse(0);

        return (double) maxGroupCount / players.size() * 100;
    }

    private double calculateGenderRatioScore(List<PlayerProfile> players, GameSession session) {
        long maleCount = players.stream()
                .filter(p -> "男".equals(p.getGender()))
                .count();
        long femaleCount = players.stream()
                .filter(p -> "女".equals(p.getGender()))
                .count();

        long maleCharacters = characterRepository.findByScriptIdAndGender(
                session.getScript().getId(), "男").size();
        long femaleCharacters = characterRepository.findByScriptIdAndGender(
                session.getScript().getId(), "女").size();
        long totalCharacters = maleCharacters + femaleCharacters;

        if (totalCharacters == 0) return 50.0;

        double expectedMaleRatio = (double) maleCharacters / totalCharacters;
        double actualMaleRatio = players.isEmpty() ? 0 : (double) maleCount / players.size();

        double diff = Math.abs(expectedMaleRatio - actualMaleRatio);
        return Math.max(0, 100 - diff * 200);
    }

    private double calculateHorrorTagScore(List<PlayerProfile> players, GameSession session) {
        boolean isHorror = session.getScript().getGenre() == ScriptGenre.HORROR;

        if (!isHorror) {
            return 80.0;
        }

        double avgTolerance = players.stream()
                .mapToInt(p -> p.getHorrorTolerance() != null ? p.getHorrorTolerance() : 5)
                .average().orElse(5.0);

        return avgTolerance * 10;
    }

    private double calculateEmotionalTagScore(List<PlayerProfile> players, GameSession session) {
        boolean isEmotional = session.getScript().getGenre() == ScriptGenre.EMOTIONAL;

        if (!isEmotional) {
            return 80.0;
        }

        double avgSensitivity = players.stream()
                .mapToInt(p -> p.getEmotionalSensitivity() != null ? p.getEmotionalSensitivity() : 5)
                .average().orElse(5.0);

        return avgSensitivity * 10;
    }

    private double calculateSocialScore(List<PlayerProfile> players) {
        double avgSocial = players.stream()
                .mapToInt(p -> p.getSocialLevel() != null ? p.getSocialLevel() : 5)
                .average().orElse(5.0);

        return avgSocial * 10;
    }

    private double calculateReasoningScore(List<PlayerProfile> players, GameSession session) {
        boolean isReasoning = session.getScript().getGenre() == ScriptGenre.REASONING ||
                session.getScript().getGenre() == ScriptGenre.SUSPENSE;

        if (!isReasoning) {
            return 70.0;
        }

        double avgReasoning = players.stream()
                .mapToInt(p -> p.getReasoningAbility() != null ? p.getReasoningAbility() : 5)
                .average().orElse(5.0);

        return avgReasoning * 10;
    }

    private List<CharacterAssignment> suggestCharacterAssignments(List<PlayerProfile> players,
                                                                   GameSession session) {
        List<ScriptCharacter> characters = characterRepository
                .findByScriptIdOrderBySortOrderAsc(session.getScript().getId());

        List<CharacterAssignment> assignments = new ArrayList<>();

        for (int i = 0; i < Math.min(players.size(), characters.size()); i++) {
            PlayerProfile player = players.get(i);
            ScriptCharacter character = characters.get(i);

            double fitScore = calculateCharacterFit(player, character);

            CharacterAssignment assignment = new CharacterAssignment();
            assignment.setPlayerId(player.getUser().getId());
            assignment.setPlayerName(player.getUser().getNickname());
            assignment.setCharacterId(character.getId());
            assignment.setCharacterName(character.getName());
            assignment.setFitScore(fitScore);

            assignments.add(assignment);
        }

        return assignments;
    }

    private double calculateCharacterFit(PlayerProfile player, ScriptCharacter character) {
        double score = 50.0;

        if (character.getGender() != null && player.getGender() != null) {
            if (character.getGender().equals(player.getGender())) {
                score += 20;
            } else {
                score -= 10;
            }
        }

        if (character.getAgeRange() != null && player.getAgeGroup() != null) {
            if (character.getAgeRange().contains(player.getAgeGroup())) {
                score += 15;
            }
        }

        score += player.getHistoryScore() != null ? player.getHistoryScore() * 0.15 : 7.5;

        return Math.min(100, Math.max(0, score));
    }
}
