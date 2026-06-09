<?php

namespace App\Services;

use App\Models\MatchRecord;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class MatchAnalyzer
{
    public function getWinRate(Collection $matches): array
    {
        $total = $matches->count();

        if ($total === 0) {
            return [
                'total' => 0,
                'wins' => 0,
                'losses' => 0,
                'win_rate' => 0,
                'game_win_rate' => 0,
            ];
        }

        $wins = $matches->where('is_winner', true)->count();
        $losses = $total - $wins;

        $totalGames = $matches->sum('game_wins') + $matches->sum('game_losses');
        $gameWins = $matches->sum('game_wins');

        return [
            'total' => $total,
            'wins' => $wins,
            'losses' => $losses,
            'win_rate' => $total > 0 ? round(($wins / $total) * 100, 2) : 0,
            'game_win_rate' => $totalGames > 0 ? round(($gameWins / $totalGames) * 100, 2) : 0,
            'total_games' => $totalGames,
            'game_wins' => $gameWins,
            'game_losses' => $matches->sum('game_losses'),
        ];
    }

    public function getWinRateByPlayOrder(Collection $matches): array
    {
        $onPlay = $matches->where('on_play', true);
        $onDraw = $matches->where('on_play', false);

        return [
            'on_play' => $this->getWinRate($onPlay),
            'on_draw' => $this->getWinRate($onDraw),
        ];
    }

    public function getWinRateByOpponentArchetype(Collection $matches, int $minMatches = 2): array
    {
        $grouped = $matches->groupBy('opponent_archetype');

        $results = [];
        foreach ($grouped as $archetype => $archetypeMatches) {
            if ($archetypeMatches->count() < $minMatches) {
                continue;
            }

            $stats = $this->getWinRate($archetypeMatches);
            $results[] = array_merge([
                'archetype' => $archetype ?? 'Unknown',
            ], $stats);
        }

        usort($results, function ($a, $b) {
            return $b['win_rate'] <=> $a['win_rate'];
        });

        return $results;
    }

    public function getWinRateByDeck(Collection $matches): array
    {
        $grouped = $matches->groupBy('deck_id');

        $results = [];
        foreach ($grouped as $deckId => $deckMatches) {
            $deck = $deckMatches->first()?->deck;
            $stats = $this->getWinRate($deckMatches);
            $results[] = array_merge([
                'deck_id' => $deckId,
                'deck_name' => $deck?->name ?? 'Unknown',
                'deck_archetype' => $deck?->archetype,
            ], $stats);
        }

        usort($results, function ($a, $b) {
            return $b['win_rate'] <=> $a['win_rate'];
        });

        return $results;
    }

    public function getWinRateByFormat(Collection $matches): array
    {
        $grouped = $matches->groupBy('format');

        $results = [];
        foreach ($grouped as $format => $formatMatches) {
            $stats = $this->getWinRate($formatMatches);
            $results[] = array_merge([
                'format' => $format,
            ], $stats);
        }

        return $results;
    }

    public function getCardContribution(int $userId, int $deckId, array $filters = []): array
    {
        $query = MatchRecord::where('user_id', $userId)
            ->where('deck_id', $deckId)
            ->whereNotNull('key_cards');

        if (! empty($filters['start_date'])) {
            $query->where('played_at', '>=', $filters['start_date']);
        }
        if (! empty($filters['end_date'])) {
            $query->where('played_at', '<=', $filters['end_date']);
        }

        $matches = $query->get();

        $cardStats = [];

        foreach ($matches as $match) {
            $keyCards = $match->key_cards ?? [];
            foreach ($keyCards as $cardName) {
                if (! isset($cardStats[$cardName])) {
                    $cardStats[$cardName] = [
                        'card_name' => $cardName,
                        'appearances' => 0,
                        'wins' => 0,
                        'losses' => 0,
                    ];
                }
                $cardStats[$cardName]['appearances']++;
                if ($match->is_winner) {
                    $cardStats[$cardName]['wins']++;
                } else {
                    $cardStats[$cardName]['losses']++;
                }
            }
        }

        foreach ($cardStats as &$stats) {
            $stats['win_rate'] = $stats['appearances'] > 0
                ? round(($stats['wins'] / $stats['appearances']) * 100, 2)
                : 0;
        }

        usort($cardStats, function ($a, $b) {
            return $b['win_rate'] <=> $a['win_rate'];
        });

        return array_values($cardStats);
    }

    public function getTrendData(Collection $matches, string $interval = 'week'): array
    {
        $sorted = $matches->sortBy('played_at');

        $trendData = [];
        $runningWins = 0;
        $runningTotal = 0;

        $currentPeriod = null;

        foreach ($sorted as $match) {
            $period = $this->getPeriodKey($match->played_at, $interval);

            if ($period !== $currentPeriod) {
                if ($currentPeriod !== null) {
                    $trendData[] = [
                        'period' => $currentPeriod,
                        'total' => $runningTotal,
                        'wins' => $runningWins,
                        'losses' => $runningTotal - $runningWins,
                        'win_rate' => $runningTotal > 0 ? round(($runningWins / $runningTotal) * 100, 2) : 0,
                    ];
                }
                $currentPeriod = $period;
                $runningWins = 0;
                $runningTotal = 0;
            }

            $runningTotal++;
            if ($match->is_winner) {
                $runningWins++;
            }
        }

        if ($currentPeriod !== null) {
            $trendData[] = [
                'period' => $currentPeriod,
                'total' => $runningTotal,
                'wins' => $runningWins,
                'losses' => $runningTotal - $runningWins,
                'win_rate' => $runningTotal > 0 ? round(($runningWins / $runningTotal) * 100, 2) : 0,
            ];
        }

        return $trendData;
    }

    private function getPeriodKey($date, string $interval): string
    {
        if (! $date instanceof \DateTimeInterface) {
            $date = new \DateTime($date);
        }

        return match ($interval) {
            'day' => $date->format('Y-m-d'),
            'week' => $date->format('Y-W'),
            'month' => $date->format('Y-m'),
            'year' => $date->format('Y'),
            default => $date->format('Y-m-d'),
        };
    }

    public function getAverageTurnCount(Collection $matches): array
    {
        $matchesWithTurns = $matches->whereNotNull('turn_count');

        if ($matchesWithTurns->isEmpty()) {
            return [
                'average' => 0,
                'average_wins' => 0,
                'average_losses' => 0,
                'sample_size' => 0,
            ];
        }

        $wins = $matchesWithTurns->where('is_winner', true);
        $losses = $matchesWithTurns->where('is_winner', false);

        return [
            'average' => (float) $matchesWithTurns->avg('turn_count'),
            'average_wins' => (float) $wins->avg('turn_count'),
            'average_losses' => (float) $losses->avg('turn_count'),
            'sample_size' => $matchesWithTurns->count(),
        ];
    }

    public function getMulliganAnalysis(Collection $matches): array
    {
        $mulliganData = [];

        foreach ($matches as $match) {
            $mulligans = $match->mulligan_count;
            if ($mulligans === null) {
                continue;
            }

            $key = (string) $mulligans;
            if (! isset($mulliganData[$key])) {
                $mulliganData[$key] = [
                    'mulligans' => (int) $mulligans,
                    'total' => 0,
                    'wins' => 0,
                ];
            }
            $mulliganData[$key]['total']++;
            if ($match->is_winner) {
                $mulliganData[$key]['wins']++;
            }
        }

        foreach ($mulliganData as &$data) {
            $data['win_rate'] = $data['total'] > 0
                ? round(($data['wins'] / $data['total']) * 100, 2)
                : 0;
        }

        ksort($mulliganData);
        return array_values($mulliganData);
    }

    public function getOpponentDistribution(Collection $matches, int $topN = 10): array
    {
        $grouped = $matches->groupBy('opponent_archetype');

        $total = $matches->count();
        $distribution = [];

        foreach ($grouped as $archetype => $archetypeMatches) {
            $count = $archetypeMatches->count();
            $distribution[] = [
                'archetype' => $archetype ?? 'Unknown',
                'count' => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 2) : 0,
            ];
        }

        usort($distribution, function ($a, $b) {
            return $b['count'] <=> $a['count'];
        });

        return array_slice($distribution, 0, $topN);
    }

    public function getFullAnalysis(int $userId, array $filters = []): array
    {
        $query = MatchRecord::where('user_id', $userId);

        if (! empty($filters['deck_id'])) {
            $query->where('deck_id', $filters['deck_id']);
        }
        if (! empty($filters['format'])) {
            $query->where('format', $filters['format']);
        }
        if (! empty($filters['start_date'])) {
            $query->where('played_at', '>=', $filters['start_date']);
        }
        if (! empty($filters['end_date'])) {
            $query->where('played_at', '<=', $filters['end_date']);
        }

        $matches = $query->orderBy('played_at', 'desc')->get();

        return [
            'overall' => $this->getWinRate($matches),
            'by_play_order' => $this->getWinRateByPlayOrder($matches),
            'by_opponent' => $this->getWinRateByOpponentArchetype($matches),
            'by_deck' => $this->getWinRateByDeck($matches),
            'by_format' => $this->getWinRateByFormat($matches),
            'opponent_distribution' => $this->getOpponentDistribution($matches),
            'trend' => $this->getTrendData($matches, $filters['interval'] ?? 'week'),
            'average_turns' => $this->getAverageTurnCount($matches),
            'mulligan_analysis' => $this->getMulliganAnalysis($matches),
        ];
    }

    public function getOverview(int $userId, array $filters = []): array
    {
        $query = MatchRecord::where('user_id', $userId);

        if (! empty($filters['deck_id'])) {
            $query->where('deck_id', $filters['deck_id']);
        }
        if (! empty($filters['format'])) {
            $query->where('format', $filters['format']);
        }

        $matches = $query->get();

        $stats = $this->getWinRate($matches);

        return [
            'total_matches' => $stats['total'],
            'total_wins' => $stats['wins'],
            'total_losses' => $stats['losses'],
            'win_rate' => $stats['win_rate'],
            'game_win_rate' => $stats['game_win_rate'],
            'total_games' => $stats['total_games'],
            'average_turns' => $this->getAverageTurnCount($matches),
        ];
    }

    public function getByDeck(int $userId, array $filters = []): array
    {
        $query = MatchRecord::where('user_id', $userId);

        if (! empty($filters['format'])) {
            $query->where('format', $filters['format']);
        }

        $matches = $query->get();

        return $this->getWinRateByDeck($matches);
    }

    public function getByOpponentArchetype(Collection $matches): array
    {
        return $this->getWinRateByOpponentArchetype($matches, 1);
    }

    public function getByFormat(Collection $matches): array
    {
        return $this->getWinRateByFormat($matches);
    }

    public function getByTurnCount(Collection $matches): array
    {
        return $this->getAverageTurnCount($matches);
    }
}
