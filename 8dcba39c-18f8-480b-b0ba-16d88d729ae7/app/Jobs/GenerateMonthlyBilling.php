<?php

namespace App\Jobs;

use App\Models\BillingRecord;
use App\Models\ReportStat;
use App\Models\Tenant;
use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GenerateMonthlyBilling implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 900;

    public function __construct(
        public ?string $monthStr = null,
        public ?int $targetTenantId = null
    ) {}

    public function handle(): void
    {
        try {
            $start = microtime(true);

            $month = $this->monthStr ? new \DateTime($this->monthStr) : new \DateTime('first day of last month');
            $monthStart = $month->format('Y-m-01 00:00:00');
            $monthEnd = $month->format('Y-m-t 23:59:59');
            $periodLabel = $month->format('Y-m');

            $tenantsQuery = Tenant::withoutGlobalScopes();
            if ($this->targetTenantId) {
                $tenantsQuery->where('id', $this->targetTenantId);
            }

            $tenants = $tenantsQuery->get(['id', 'name', 'plan', 'billing_email', 'subdomain']);
            $billsGenerated = 0;
            $totalAmount = 0;

            foreach ($tenants as $tenant) {
                $tenantId = $tenant->id;
                app()->instance('currentTenantId', $tenantId);

                $plan = config("saas.plans.{$tenant->plan}", config('saas.plans.standard'));
                $planPriceMonthly = $plan['price_monthly'] ?? 0;

                $ticketsCount = Ticket::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count();

                $statsData = ReportStat::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->whereBetween('stat_date', [
                        $month->format('Y-m-01'),
                        $month->format('Y-m-t')
                    ])
                    ->where('dimension', 'overview')
                    ->get();

                $monthlyStats = [
                    'tickets_created' => 0,
                    'tickets_resolved' => 0,
                    'tickets_closed' => 0,
                    'csat_count' => 0,
                    'csat_sum' => 0,
                ];

                foreach ($statsData as $stat) {
                    $raw = $stat->raw_metrics;
                    $monthlyStats['tickets_created'] += $raw['tickets_created'] ?? 0;
                    $monthlyStats['tickets_resolved'] += $raw['tickets_resolved'] ?? 0;
                    $monthlyStats['tickets_closed'] += $raw['tickets_closed'] ?? 0;
                    $monthlyStats['csat_count'] += $raw['csat_count'] ?? 0;
                    $avg = $raw['csat_average'] ?? 0;
                    $count = $raw['csat_count'] ?? 0;
                    $monthlyStats['csat_sum'] += $avg * $count;
                }

                $avgCsat = $monthlyStats['csat_count'] > 0
                    ? round($monthlyStats['csat_sum'] / $monthlyStats['csat_count'], 2)
                    : 0;

                $usageDetails = [
                    'plan' => $tenant->plan,
                    'plan_name' => $plan['name'] ?? 'Standard',
                    'max_tickets' => $plan['max_tickets'] ?? null,
                    'max_agents' => $plan['max_agents'] ?? null,
                    'tickets_created' => $monthlyStats['tickets_created'],
                    'tickets_resolved' => $monthlyStats['tickets_resolved'],
                    'tickets_closed' => $monthlyStats['tickets_closed'],
                    'avg_csat' => $avgCsat,
                    'overage_tickets' => 0,
                ];

                $overageCharges = 0;
                if (!empty($plan['max_tickets']) && $plan['max_tickets'] > 0) {
                    $overage = max(0, $ticketsCount - $plan['max_tickets']);
                    if ($overage > 0) {
                        $overageRate = 0.1;
                        $overageCharges = (int)ceil($overage * $overageRate);
                        $usageDetails['overage_tickets'] = $overage;
                    }
                }

                $subtotal = $planPriceMonthly + $overageCharges;
                $taxRate = 0.06;
                $taxAmount = (int)round($subtotal * $taxRate);
                $totalAmountForBill = $subtotal + $taxAmount;

                $existing = BillingRecord::withoutGlobalScopes()
                    ->where('tenant_id', $tenantId)
                    ->where('billing_period', $periodLabel)
                    ->first();

                if ($existing) {
                    continue;
                }

                DB::beginTransaction();
                try {
                    BillingRecord::create([
                        'tenant_id' => $tenantId,
                        'billing_period' => $periodLabel,
                        'billing_start_date' => $monthStart,
                        'billing_end_date' => $monthEnd,
                        'plan' => $tenant->plan,
                        'base_amount' => $planPriceMonthly,
                        'usage_charges' => $overageCharges,
                        'tax_amount' => $taxAmount,
                        'total_amount' => $totalAmountForBill,
                        'currency' => 'CNY',
                        'status' => 'pending',
                        'issued_at' => now(),
                        'due_date' => now()->addDays(30),
                        'usage_details' => $usageDetails,
                        'billing_email' => $tenant->billing_email,
                    ]);

                    DB::commit();

                    if ($tenant->billing_email && app()->bound('notification.service')) {
                        try {
                            app('notification.service')->sendGenericEmail(
                                $tenant->billing_email,
                                null,
                                'billing_invoice_generated',
                                [
                                    'tenant_name' => $tenant->name,
                                    'billing_period' => $periodLabel,
                                    'plan_name' => $plan['name'] ?? 'Standard',
                                    'base_amount' => number_format($planPriceMonthly, 2),
                                    'overage_charges' => number_format($overageCharges, 2),
                                    'tax_amount' => number_format($taxAmount, 2),
                                    'total_amount' => number_format($totalAmountForBill, 2),
                                    'tickets_count' => $ticketsCount,
                                    'due_date' => now()->addDays(30)->format('Y-m-d'),
                                ],
                                "【{$tenant->name}】{$periodLabel}账单已生成 - ¥" . number_format($totalAmountForBill, 2)
                            );
                        } catch (\Throwable $e) {
                            Log::error('[Billing] Email error: ' . $e->getMessage());
                        }
                    }

                    $billsGenerated++;
                    $totalAmount += $totalAmountForBill;
                } catch (\Throwable $e) {
                    DB::rollBack();
                    Log::error('[Billing] Create error for tenant ' . $tenantId . ': ' . $e->getMessage());
                }
            }

            $executionMs = (int)((microtime(true) - $start) * 1000);

            Log::info('[Monthly Billing] Completed', [
                'period' => $periodLabel,
                'tenants_total' => $tenants->count(),
                'bills_generated' => $billsGenerated,
                'total_amount' => $totalAmount,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[Monthly Billing] Fatal error: ' . $e->getMessage(), [
                'period' => $this->monthStr,
                'tenant_id' => $this->targetTenantId,
                'trace' => $e->getTraceAsString(),
            ]);
            throw $e;
        }
    }
}
