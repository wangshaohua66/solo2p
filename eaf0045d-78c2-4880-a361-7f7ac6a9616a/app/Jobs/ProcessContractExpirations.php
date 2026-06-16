<?php

namespace App\Jobs;

use App\Services\ContractService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessContractExpirations implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 120;

    public function handle(ContractService $contractService): void
    {
        Log::info('开始处理到期合同...');

        try {
            $results = $contractService->processExpiringContracts();

            Log::info('到期合同处理完成', [
                'reminded_3d' => $results['reminded_3d'],
                'reminded_1d' => $results['reminded_1d'],
                'breached' => $results['breached'],
            ]);
        } catch (\Exception $e) {
            Log::error('处理到期合同时发生错误', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }

    public function uniqueId(): string
    {
        return 'process-contract-expirations-' . now()->toDateString();
    }
}
