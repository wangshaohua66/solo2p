<?php

namespace App\Console\Commands;

use App\Models\MatchRecord;
use App\Models\MetaSnapshot;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MetaGenerateReport extends Command
{
    protected $signature = 'meta:generate-report {--format=standard : Format to generate report for}
                            {--weeks=4 : Number of weeks to analyze}';

    protected $description = 'Generate meta report based on match history';

    public function handle(): int
    {
        $format = $this->option('format');
        $weeks = (int) $this->option('weeks');

        $this->info("Generating meta report for {$format} (last {$weeks} weeks)...");

        try {
            $startDate = now()->subWeeks($weeks);

            $matches = MatchRecord::where('format', $format)
                ->where('played_at', '>=', $startDate)
                ->get();

            if ($matches->isEmpty()) {
                $this->warn("No matches found for {$format} in the last {$weeks} weeks");
                return self::SUCCESS;
            }

            $archetypeStats = [];
            $totalMatches = $matches->count();

            foreach ($matches as $match) {
                $archetype = $match->opponent_archetype ?? 'Unknown';
                if (! isset($archetypeStats[$archetype])) {
                    $archetypeStats[$archetype] = [
                        'name' => $archetype,
                        'count' => 0,
                        'wins' => 0,
                        'losses' => 0,
                    ];
                }
                $archetypeStats[$archetype]['count']++;
                if ($match->is_winner) {
                    $archetypeStats[$archetype]['wins']++;
                } else {
                    $archetypeStats[$archetype]['losses']++;
                }
            }

            $snapshot = MetaSnapshot::create([
                'format' => $format,
                'snapshot_date' => now()->toDateString(),
                'total_decks' => $totalMatches,
                'source' => 'local_match_history',
                'notes' => "Generated from last {$weeks} weeks of match history",
            ]);

            foreach ($archetypeStats as $stat) {
                $snapshot->archetypes()->create([
                    'name' => $stat['name'],
                    'percentage' => round(($stat['count'] / $totalMatches) * 100, 2),
                    'win_rate' => $stat['count'] > 0
                        ? round(($stat['wins'] / $stat['count']) * 100, 2)
                        : null,
                    'sample_size' => $stat['count'],
                ]);
            }

            $this->info("Meta report generated successfully:");
            $this->line("  Format: {$format}");
            $this->line("  Period: {$weeks} weeks");
            $this->line("  Total matches: {$totalMatches}");
            $this->line("  Archetypes: " . count($archetypeStats));
            $this->line("  Snapshot ID: {$snapshot->id}");

            Log::info('Meta report generated', [
                'format' => $format,
                'weeks' => $weeks,
                'total_matches' => $totalMatches,
                'archetypes' => count($archetypeStats),
            ]);

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Meta report generation failed: ' . $e->getMessage());
            Log::error('Meta report generation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return self::FAILURE;
        }
    }
}
