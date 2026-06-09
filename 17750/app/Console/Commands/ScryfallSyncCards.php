<?php

namespace App\Console\Commands;

use App\Services\ScryfallSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ScryfallSyncCards extends Command
{
    protected $signature = 'scryfall:sync-cards {--full : Perform a full sync instead of incremental}
                            {--incremental : Perform an incremental sync (default)}';

    protected $description = 'Sync cards from Scryfall (incremental by default)';

    public function __construct(
        protected ScryfallSyncService $syncService
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $fullSync = $this->option('full') && !$this->option('incremental');
        $syncType = $fullSync ? 'full' : 'incremental';

        $this->info("Starting {$syncType} card sync from Scryfall...");

        if (! $fullSync) {
            $checkpoint = $this->syncService->getCheckpoint();
            if ($checkpoint) {
                $this->line("Resuming from checkpoint: {$checkpoint['processed']} cards processed at {$checkpoint['timestamp']}");
            }
        }

        try {
            $stats = $this->syncService->syncAllCards($fullSync);

            $this->info('Card sync completed:');
            $this->line("  Created: {$stats['created']}");
            $this->line("  Updated: {$stats['updated']}");
            $this->line("  Skipped: {$stats['skipped']}");
            $this->line("  Errors: {$stats['errors']}");
            $this->line("  Total processed: {$stats['total_processed']}");

            Log::info("Scryfall {$syncType} card sync completed", $stats);

            if ($fullSync) {
                $this->syncService->clearCheckpoint();
            }

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Card sync failed: ' . $e->getMessage());
            Log::error('Scryfall card sync failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return self::FAILURE;
        }
    }
}
