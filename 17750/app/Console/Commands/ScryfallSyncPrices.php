<?php

namespace App\Console\Commands;

use App\Services\ScryfallSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ScryfallSyncPrices extends Command
{
    protected $signature = 'scryfall:sync-prices';

    protected $description = 'Sync card prices from Scryfall for collection items';

    public function __construct(
        protected ScryfallSyncService $syncService
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $this->info('Starting price sync from Scryfall...');

        try {
            $stats = $this->syncService->updatePrices();

            $this->info('Price sync completed:');
            $this->line("  Updated: {$stats['updated']}");
            $this->line("  Skipped: {$stats['skipped']}");
            $this->line("  Errors: {$stats['errors']}");

            Log::info('Scryfall price sync completed', $stats);

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Price sync failed: ' . $e->getMessage());
            Log::error('Scryfall price sync failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return self::FAILURE;
        }
    }
}
