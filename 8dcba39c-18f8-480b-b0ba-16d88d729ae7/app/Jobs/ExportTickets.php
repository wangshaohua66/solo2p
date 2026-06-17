<?php

namespace App\Jobs;

use App\Models\Ticket;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExportTickets implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 2;
    public $timeout = 600;

    public function __construct(
        public int $tenantId,
        public int $userId,
        public array $filters,
        public string $format = 'csv',
        public string $exportId,
        public string $userEmail
    ) {}

    public function handle(): void
    {
        try {
            app()->instance('currentTenantId', $this->tenantId);

            $start = microtime(true);
            $maxRows = (int)config('saas.export.max_rows', 100000);
            $chunkSize = (int)config('saas.export.chunk_size', 1000);
            $tempDir = config('saas.export.temp_directory', storage_path('app/exports'));

            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $filename = "tickets_export_{$this->tenantId}_{$this->exportId}.{$this->format}";
            $filepath = $tempDir . '/' . $filename;

            $query = Ticket::withoutGlobalScopes()
                ->where('tenant_id', $this->tenantId)
                ->with(['assignee', 'reporter', 'category', 'group', 'tags'])
                ->limit($maxRows);

            if (!empty($this->filters['status'])) {
                $query->whereIn('status', (array)$this->filters['status']);
            }
            if (!empty($this->filters['priority'])) {
                $query->whereIn('priority', (array)$this->filters['priority']);
            }
            if (!empty($this->filters['assignee_id'])) {
                $query->whereIn('assignee_id', (array)$this->filters['assignee_id']);
            }
            if (!empty($this->filters['category_id'])) {
                $query->whereIn('category_id', (array)$this->filters['category_id']);
            }
            if (!empty($this->filters['group_id'])) {
                $query->whereIn('group_id', (array)$this->filters['group_id']);
            }
            if (!empty($this->filters['date_from'])) {
                $query->where('created_at', '>=', $this->filters['date_from']);
            }
            if (!empty($this->filters['date_to'])) {
                $query->where('created_at', '<=', $this->filters['date_to']);
            }

            $totalRows = 0;
            $columns = [
                '工单号', '标题', '状态', '优先级', '分类', '客服组',
                '处理人', '提交人', '创建时间', '更新时间', '解决时间',
                '关闭时间', '标签', '来源', '满意度'
            ];

            $handle = fopen($filepath, 'w');
            if ($this->format === 'csv') {
                fwrite($handle, "\xEF\xBB\xBF");
                fputcsv($handle, $columns);
            } elseif ($this->format === 'json') {
                fwrite($handle, "[\n");
            }

            $firstChunk = true;
            $query->chunk($chunkSize, function ($tickets) use ($handle, &$totalRows, &$firstChunk) {
                foreach ($tickets as $ticket) {
                    $row = [
                        $ticket->ticket_number,
                        $ticket->subject,
                        $ticket->status,
                        $ticket->priority,
                        optional($ticket->category)->name ?? '-',
                        optional($ticket->group)->name ?? '-',
                        optional($ticket->assignee)->name ?? 'Unassigned',
                        optional($ticket->reporter)->name ?? 'Unknown',
                        $ticket->created_at ? $ticket->created_at->toDateTimeString() : '',
                        $ticket->updated_at ? $ticket->updated_at->toDateTimeString() : '',
                        $ticket->resolved_at ? $ticket->resolved_at->toDateTimeString() : '',
                        $ticket->closed_at ? $ticket->closed_at->toDateTimeString() : '',
                        $ticket->tags->pluck('name')->implode(', '),
                        $ticket->source ?? 'web',
                        $ticket->satisfaction_rating ? ($ticket->satisfaction_rating . '/5') : '',
                    ];

                    if ($this->format === 'csv') {
                        fputcsv($handle, $row);
                    } elseif ($this->format === 'json') {
                        $jsonRow = json_encode(array_combine([
                            'ticket_number', 'subject', 'status', 'priority', 'category',
                            'group', 'assignee', 'reporter', 'created_at', 'updated_at',
                            'resolved_at', 'closed_at', 'tags', 'source', 'satisfaction'
                        ], $row), JSON_UNESCAPED_UNICODE);

                        if (!$firstChunk) {
                            fwrite($handle, ",\n");
                        }
                        fwrite($handle, "  " . $jsonRow);
                        $firstChunk = false;
                    }

                    $totalRows++;
                }
            });

            if ($this->format === 'json') {
                fwrite($handle, "\n]\n");
            }
            fclose($handle);

            $executionMs = (int)((microtime(true) - $start) * 1000);

            $downloadUrl = Storage::url('exports/' . $filename);

            if (app()->bound('notification.service')) {
                try {
                    app('notification.service')->sendGenericEmail(
                        $this->userEmail,
                        null,
                        'ticket_export_ready',
                        [
                            'export_id' => $this->exportId,
                            'total_rows' => $totalRows,
                            'format' => strtoupper($this->format),
                            'download_url' => $downloadUrl,
                            'expire_hours' => (int)config('saas.export.expire_hours', 24),
                        ],
                        '工单导出完成 - ' . $totalRows . '条数据'
                    );
                } catch (\Throwable $e) {
                    Log::error('[Export] Notification failed: ' . $e->getMessage());
                }
            }

            Log::info('[Export] Tickets completed', [
                'export_id' => $this->exportId,
                'tenant_id' => $this->tenantId,
                'user_id' => $this->userId,
                'format' => $this->format,
                'total_rows' => $totalRows,
                'duration_ms' => $executionMs,
            ]);
        } catch (\Throwable $e) {
            Log::error('[Export] Tickets error: ' . $e->getMessage(), [
                'export_id' => $this->exportId,
                'tenant_id' => $this->tenantId,
                'trace' => $e->getTraceAsString(),
            ]);

            if (app()->bound('notification.service')) {
                try {
                    app('notification.service')->sendGenericEmail(
                        $this->userEmail,
                        null,
                        'ticket_export_failed',
                        [
                            'export_id' => $this->exportId,
                            'error_message' => $e->getMessage(),
                        ],
                        '工单导出失败'
                    );
                } catch (\Throwable) {
                }
            }

            throw $e;
        }
    }
}
