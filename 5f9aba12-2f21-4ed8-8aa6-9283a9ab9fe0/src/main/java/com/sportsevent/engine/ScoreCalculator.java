package com.sportsevent.engine;

import com.sportsevent.entity.*;
import com.sportsevent.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ScoreCalculator {

    private final LeagueRepository leagueRepository;
    private final MatchRepository matchRepository;
    private final ScoreRepository scoreRepository;
    private final RankingRepository rankingRepository;
    private final KnockoutBracketRepository knockoutBracketRepository;
    private final RegistrationRepository registrationRepository;
    private final TeamRepository teamRepository;

    public CalculationResult calculateGroupRankings(String leagueId) {
        CalculationResult result = new CalculationResult();
        result.setLeagueId(leagueId);

        Optional<League> leagueOpt = leagueRepository.findById(leagueId);
        if (leagueOpt.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("League not found: " + leagueId);
            return result;
        }

        League league = leagueOpt.get();
        League.ScoringRule scoringRule = league.getScoringRule();
        if (scoringRule == null) {
            scoringRule = getDefaultScoringRule(league.getSportType());
        }

        List<Match> matches = matchRepository.findByLeagueIdAndStage(leagueId, Match.StageType.GROUP_STAGE);
        List<Score> confirmedScores = scoreRepository.findByLeagueIdAndStatus(leagueId, Score.ScoreStatus.CONFIRMED);
        List<Score> validScores = confirmedScores.stream()
                .filter(s -> !Boolean.TRUE.equals(s.isExcludedFromRanking()))
                .collect(Collectors.toList());
        Map<String, Score> scoreMap = validScores.stream()
                .collect(Collectors.toMap(Score::getMatchId, s -> s));

        Map<String, List<Match>> groupMatchesMap = matches.stream()
                .filter(m -> m.getGroupName() != null)
                .collect(Collectors.groupingBy(Match::getGroupName));

        List<Ranking> allRankings = new ArrayList<>();
        final League.ScoringRule finalScoringRule = scoringRule;

        for (Map.Entry<String, List<Match>> groupEntry : groupMatchesMap.entrySet()) {
            String groupName = groupEntry.getKey();
            List<Match> groupMatches = groupEntry.getValue();

            Set<String> teamIds = new HashSet<>();
            for (Match m : groupMatches) {
                if (m.getTeamAId() != null) teamIds.add(m.getTeamAId());
                if (m.getTeamBId() != null) teamIds.add(m.getTeamBId());
            }

            Map<String, Ranking> rankingMap = new HashMap<>();
            for (String teamId : teamIds) {
                Ranking ranking = rankingRepository.findByLeagueIdAndGroupNameAndTeamId(
                        leagueId, groupName, teamId).orElseGet(() -> {
                    Ranking r = new Ranking();
                    r.setLeagueId(leagueId);
                    r.setGroupName(groupName);
                    r.setTeamId(teamId);
                    r.setPlayed(0);
                    r.setWon(0);
                    r.setDrawn(0);
                    r.setLost(0);
                    r.setGoalsFor(0);
                    r.setGoalsAgainst(0);
                    r.setGoalDifference(0);
                    r.setPoints(0);
                    r.setCreatedAt(LocalDateTime.now());
                    return r;
                });
                ranking.setPlayed(0);
                ranking.setWon(0);
                ranking.setDrawn(0);
                ranking.setLost(0);
                ranking.setGoalsFor(0);
                ranking.setGoalsAgainst(0);
                ranking.setPoints(0);
                rankingMap.put(teamId, ranking);
            }

            Map<String, List<MatchResult>> headToHeadResults = new HashMap<>();

            for (Match match : groupMatches) {
                if (match.getStatus() != Match.MatchStatus.FINISHED) continue;

                Score score = scoreMap.get(match.getId());
                if (score == null) continue;

                updateTeamStats(rankingMap.get(match.getTeamAId()), score.getTeamAScore(), score.getTeamBScore(),
                        finalScoringRule);
                updateTeamStats(rankingMap.get(match.getTeamBId()), score.getTeamBScore(), score.getTeamAScore(),
                        finalScoringRule);

                if (finalScoringRule.isUseHeadToHead()) {
                    String keyA = match.getTeamAId() + "vs" + match.getTeamBId();
                    String keyB = match.getTeamBId() + "vs" + match.getTeamAId();
                    MatchResult resultA = new MatchResult(match.getTeamAId(), match.getTeamBId(),
                            score.getTeamAScore(), score.getTeamBScore());
                    headToHeadResults.computeIfAbsent(keyA, k -> new ArrayList<>()).add(resultA);
                    headToHeadResults.computeIfAbsent(keyB, k -> new ArrayList<>()).add(resultA);
                }
            }

            for (Ranking ranking : rankingMap.values()) {
                ranking.setGoalDifference(ranking.getGoalsFor() - ranking.getGoalsAgainst());
                ranking.setLastCalculatedAt(LocalDateTime.now());
                ranking.setUpdatedAt(LocalDateTime.now());
            }

            List<Ranking> groupRankings = new ArrayList<>(rankingMap.values());

            groupRankings.sort((r1, r2) -> {
                int pointsDiff = Integer.compare(r2.getPoints(), r1.getPoints());
                if (pointsDiff != 0) return pointsDiff;

                if (finalScoringRule.isUseGoalDifference()) {
                    int gdDiff = Integer.compare(r2.getGoalDifference(), r1.getGoalDifference());
                    if (gdDiff != 0) return gdDiff;
                }

                int gfDiff = Integer.compare(r2.getGoalsFor(), r1.getGoalsFor());
                if (gfDiff != 0) return gfDiff;

                if (finalScoringRule.isUseHeadToHead()) {
                    int hth = compareHeadToHead(r1, r2, headToHeadResults);
                    if (hth != 0) return hth;
                }

                return Integer.compare(r2.getWon(), r1.getWon());
            });

            int position = 1;
            for (Ranking r : groupRankings) {
                r.setPosition(position++);
                r.setQualificationStatus(determineQualification(groupRankings.indexOf(r),
                        groupRankings.size(), league));
            }

            allRankings.addAll(groupRankings);
        }

        List<Ranking> savedRankings = rankingRepository.saveAll(allRankings);
        result.setRankings(savedRankings);
        result.setSuccess(true);
        result.setMessage("Calculated rankings for " + allRankings.size() + " teams");

        log.info("Rankings calculated for league {}: {} teams across {} groups",
                leagueId, allRankings.size(), groupMatchesMap.size());

        return result;
    }

    private void updateTeamStats(Ranking ranking, int goalsFor, int goalsAgainst,
                                  League.ScoringRule rule) {
        if (ranking == null) return;

        ranking.setPlayed(ranking.getPlayed() + 1);
        ranking.setGoalsFor(ranking.getGoalsFor() + goalsFor);
        ranking.setGoalsAgainst(ranking.getGoalsAgainst() + goalsAgainst);

        if (goalsFor > goalsAgainst) {
            ranking.setWon(ranking.getWon() + 1);
            ranking.setPoints(ranking.getPoints() + rule.getWinPoints());
        } else if (goalsFor == goalsAgainst) {
            ranking.setDrawn(ranking.getDrawn() + 1);
            ranking.setPoints(ranking.getPoints() + rule.getDrawPoints());
        } else {
            ranking.setLost(ranking.getLost() + 1);
            ranking.setPoints(ranking.getPoints() + rule.getLosePoints());
        }
    }

    private int compareHeadToHead(Ranking r1, Ranking r2,
                                   Map<String, List<MatchResult>> headToHeadResults) {
        String key = r1.getTeamId() + "vs" + r2.getTeamId();
        List<MatchResult> results = headToHeadResults.getOrDefault(key, Collections.emptyList());

        int r1Wins = 0, r2Wins = 0, r1Goals = 0, r2Goals = 0;
        for (MatchResult mr : results) {
            if (mr.teamAId.equals(r1.getTeamId())) {
                r1Goals += mr.teamAScore;
                r2Goals += mr.teamBScore;
                if (mr.teamAScore > mr.teamBScore) r1Wins++;
                else if (mr.teamBScore > mr.teamAScore) r2Wins++;
            } else {
                r1Goals += mr.teamBScore;
                r2Goals += mr.teamAScore;
                if (mr.teamBScore > mr.teamAScore) r1Wins++;
                else if (mr.teamAScore > mr.teamBScore) r2Wins++;
            }
        }

        if (r1Wins != r2Wins) return Integer.compare(r2Wins, r1Wins);
        return Integer.compare(r2Goals - r1Goals, 0);
    }

    private Ranking.QualificationStatus determineQualification(int index, int totalTeams, League league) {
        int advanceCount = Math.min(totalTeams / 2, 4);
        if (index < advanceCount) return Ranking.QualificationStatus.QUALIFIED;
        return Ranking.QualificationStatus.PENDING;
    }

    public KnockoutGenerationResult generateKnockoutBracket(String leagueId) {
        KnockoutGenerationResult result = new KnockoutGenerationResult();
        result.setLeagueId(leagueId);

        Optional<League> leagueOpt = leagueRepository.findById(leagueId);
        if (leagueOpt.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("League not found");
            return result;
        }

        List<Ranking> rankings = rankingRepository.findByLeagueId(leagueId);
        if (rankings.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("No rankings found. Run group ranking calculation first.");
            return result;
        }

        Map<String, List<Ranking>> groupRankingsMap = rankings.stream()
                .filter(r -> r.getQualificationStatus() == Ranking.QualificationStatus.QUALIFIED)
                .collect(Collectors.groupingBy(Ranking::getGroupName));

        List<Ranking> qualifiedTeams = new ArrayList<>();
        for (List<Ranking> groupList : groupRankingsMap.values()) {
            int advance = Math.min(2, groupList.size());
            groupList.sort(Comparator.comparingInt(Ranking::getPosition));
            qualifiedTeams.addAll(groupList.subList(0, advance));
        }

        int bracketSize = nextPowerOfTwo(qualifiedTeams.size());
        List<Ranking> seededTeams = seedTeams(qualifiedTeams, bracketSize);

        KnockoutBracket bracket = new KnockoutBracket();
        bracket.setLeagueId(leagueId);
        bracket.setStage(Match.StageType.ROUND_OF_16);
        bracket.setStatus(KnockoutBracket.BracketStatus.GENERATED);
        bracket.setGeneratedAt(LocalDateTime.now());
        bracket.setUpdatedAt(LocalDateTime.now());

        List<KnockoutBracket.BracketNode> nodes = new ArrayList<>();
        for (int i = 0; i < bracketSize / 2; i++) {
            Ranking team1 = i * 2 < seededTeams.size() ? seededTeams.get(i * 2) : null;
            Ranking team2 = i * 2 + 1 < seededTeams.size() ? seededTeams.get(i * 2 + 1) : null;

            Optional<Team> t1Opt = team1 != null ? teamRepository.findById(team1.getTeamId()) : Optional.empty();
            Optional<Team> t2Opt = team2 != null ? teamRepository.findById(team2.getTeamId()) : Optional.empty();

            KnockoutBracket.BracketNode node1 = createNode("R16-" + (i * 2) + "-A", i * 2,
                    team1 != null ? team1.getTeamId() : null,
                    t1Opt.map(Team::getName).orElse(null),
                    team1 != null ? "Group " + team1.getGroupName() + " #1" : null,
                    team1 == null);
            KnockoutBracket.BracketNode node2 = createNode("R16-" + (i * 2 + 1) + "-B", i * 2 + 1,
                    team2 != null ? team2.getTeamId() : null,
                    t2Opt.map(Team::getName).orElse(null),
                    team2 != null ? "Group " + team2.getGroupName() + " #2" : null,
                    team2 == null);

            nodes.add(node1);
            nodes.add(node2);
        }

        bracket.setNodes(nodes);
        KnockoutBracket saved = knockoutBracketRepository.save(bracket);

        result.setBracket(saved);
        result.setSuccess(true);
        result.setMessage("Knockout bracket generated with " + bracketSize + " slots");

        log.info("Knockout bracket generated for league {} with {} qualified teams",
                leagueId, qualifiedTeams.size());

        return result;
    }

    private KnockoutBracket.BracketNode createNode(String nodeId, int position,
                                                    String teamId, String teamName,
                                                    String sourceNote, boolean isBye) {
        KnockoutBracket.BracketNode node = new KnockoutBracket.BracketNode();
        node.setNodeId(nodeId);
        node.setPosition(position);
        node.setTeamId(teamId);
        node.setTeamName(teamName);
        node.setSourceRankingNote(sourceNote);
        node.setBye(isBye);
        node.setStatus(isBye ? KnockoutBracket.BracketNode.BracketNodeStatus.CONFIRMED
                : KnockoutBracket.BracketNode.BracketNodeStatus.PENDING);
        return node;
    }

    private List<Ranking> seedTeams(List<Ranking> teams, int bracketSize) {
        List<Ranking> result = new ArrayList<>(teams);
        result.sort(Comparator.comparingInt(Ranking::getPosition)
                .thenComparing((r1, r2) -> Integer.compare(r2.getPoints(), r1.getPoints())));
        return result;
    }

    private int nextPowerOfTwo(int n) {
        int p = 1;
        while (p < n) p <<= 1;
        return Math.max(p, 2);
    }

    private League.ScoringRule getDefaultScoringRule(League.SportType sportType) {
        League.ScoringRule rule = new League.ScoringRule();
        switch (sportType) {
            case SOCCER:
                rule.setWinPoints(3);
                rule.setDrawPoints(1);
                rule.setLosePoints(0);
                rule.setUseGoalDifference(true);
                rule.setUseHeadToHead(true);
                break;
            case BASKETBALL:
                rule.setWinPoints(2);
                rule.setDrawPoints(1);
                rule.setLosePoints(0);
                rule.setUseGoalDifference(true);
                rule.setUseHeadToHead(false);
                break;
            default:
                rule.setWinPoints(2);
                rule.setDrawPoints(1);
                rule.setLosePoints(0);
                rule.setUseGoalDifference(false);
                rule.setUseHeadToHead(true);
        }
        return rule;
    }

    @lombok.Data
    public static class CalculationResult {
        private String leagueId;
        private boolean success;
        private String message;
        private List<Ranking> rankings;
    }

    @lombok.Data
    public static class KnockoutGenerationResult {
        private String leagueId;
        private boolean success;
        private String message;
        private KnockoutBracket bracket;
    }

    @lombok.AllArgsConstructor
    private static class MatchResult {
        String teamAId;
        String teamBId;
        int teamAScore;
        int teamBScore;
    }
}
