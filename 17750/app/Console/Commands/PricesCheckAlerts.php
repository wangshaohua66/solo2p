<?php

namespace App\Console\Commands;

use App\Models\CollectionItem;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PricesCheckAlerts extends Command
{
    protected $signature = 'prices:check-alerts {--threshold= : Price change threshold percentage (default from .env)}';

    protected $description = 'Check price alerts for collection items and notify on significant changes';

    public function handle(): int
    {
        $threshold = $this->option('threshold') ?? env('PRICE_ALERT_THRESHOLD', 10);

        $this->info("Checking price alerts with threshold: {$threshold}%");

        try {
            $alerts = [];
            $collectionItems = CollectionItem::with(['card', 'priceHistories'])
                ->whereHas('card', function ($query) {
                    $query->whereNotNull('price_usd');
                })
                ->get();

            foreach ($collectionItems as $item) {
                $card = $item->card;
                $currentPrice = $card->price_usd;

                $previousPrice = $item->priceHistories()
                    ->where('price_date', '<', now()->toDateString())
                    ->latest('price_date')
                    ->value('price_usd');

                if ($previousPrice === null || $previousPrice == 0) {
                    continue;
                }

                $changePercent = (($currentPrice - $previousPrice) / $previousPrice) * 100;

                if (abs($changePercent) >= $threshold) {
                    $alerts[] = [
                        'card_name' => $card->name,
                        'card_id' => $card->id,
                        'previous_price' => $previousPrice,
                        'current_price' => $currentPrice,
                        'change_percent' => round($changePercent, 2),
                        'quantity' => $item->quantity,
                        'value_change' => round(($currentPrice - $previousPrice) * $item->quantity, 2),
                    ];
                }
            }

            if (empty($alerts)) {
                $this->info('No price alerts found.');
                Log::info('Price alert check completed - no alerts found', [
                    'threshold' => $threshold,
                    'items_checked' => $collectionItems->count(),
                ]);
                return self::SUCCESS;
            }

            $this->info('Price alerts found: ' . count($alerts));
            $this->table(
                ['Card', 'Previous', 'Current', 'Change %', 'Qty', 'Value Change'],
                array_map(fn($a) => [
                    $a['card_name'],
                    '$' . number_format($a['previous_price'], 2),
                    '$' . number_format($a['current_price'], 2),
                    ($a['change_percent'] > 0 ? '+' : '') . $a['change_percent'] . '%',
                    $a['quantity'],
                    ($a['value_change'] > 0 ? '+' : '') . '$' . number_format($a['value_change'], 2),
                ], $alerts)
            );

            Log::info('Price alert check completed', [
                'threshold' => $threshold,
                'items_checked' => $collectionItems->count(),
                'alerts_found' => count($alerts),
                'total_value_change' => array_sum(array_column($alerts, 'value_change')),
            ]);

            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Price alert check failed: ' . $e->getMessage());
            Log::error('Price alert check failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return self::FAILURE;
        }
    }
}
