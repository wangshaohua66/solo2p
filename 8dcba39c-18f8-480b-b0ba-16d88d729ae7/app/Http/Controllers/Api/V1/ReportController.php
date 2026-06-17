<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * @OA\Tag(
 *     name="Reports",
 *     description="统计报表 - 9大报表模块:总览/绩效/SLA/满意度/分布/趋势/建议/账单"
 * )
 */
class ReportController extends Controller
{
    /**
     * @OA\Get(
     *     path="/reports/overview",
     *     tags={"Reports"},
     *     summary="租户总览报表",
     *     description="18项核心指标+多维分布。5分钟Redis缓存",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Parameter(name="start_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", @OA\Schema(type="string", format="date")),
     *     @OA\Response(response=200, description="总览数据")
     * )
     */
    public function overview(Request $request)
    {
        $tenantId = app('currentTenantId');
        $start = $request->input('start_date', now()->subDays(30)->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));
        $cacheKey = "tenant:{$tenantId}:report:overview:{$start}:{$end}";

        $data = Cache::remember($cacheKey, 300, function () use ($start, $end) {
            return app('report.service')->getOverviewStats($start, $end);
        });

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
            'cached' => Cache::has($cacheKey),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/agents",
     *     tags={"Reports"},
     *     summary="客服绩效排名榜",
     *     description="12项指标+综合效率分(0-100)",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="客服绩效数据")
     * )
     */
    public function agentPerformance(Request $request)
    {
        $tenantId = app('currentTenantId');
        $start = $request->input('start_date', now()->subDays(30)->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));
        $cacheKey = "tenant:{$tenantId}:report:agents:{$start}:{$end}";

        $data = Cache::remember($cacheKey, 300, function () use ($start, $end) {
            return app('report.service')->getAgentPerformance($start, $end);
        });

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
            'cached' => Cache::has($cacheKey),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/sla",
     *     tags={"Reports"},
     *     summary="SLA绩效报表",
     *     description="20项指标:首响计量/解决计量/合规率/违规Top10工单",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="SLA绩效数据")
     * )
     */
    public function slaPerformance(Request $request)
    {
        $tenantId = app('currentTenantId');
        $start = $request->input('start_date', now()->subDays(30)->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));
        $cacheKey = "tenant:{$tenantId}:report:sla:{$start}:{$end}";

        $data = Cache::remember($cacheKey, 300, function () use ($start, $end) {
            return app('report.service')->getSLAPerformance($start, $end);
        });

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
            'cached' => Cache::has($cacheKey),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/satisfaction",
     *     tags={"Reports"},
     *     summary="客户满意度CSAT报表",
     *     description="5星分布+正负中占比+最新100条评论",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="满意度数据")
     * )
     */
    public function satisfaction(Request $request)
    {
        $tenantId = app('currentTenantId');
        $start = $request->input('start_date', now()->subDays(30)->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));

        $data = app('report.service')->getSatisfactionReport($start, $end);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/categories",
     *     tags={"Reports"},
     *     summary="工单多维分布分析",
     *     description="按分类/来源/优先级/客服组四维分布+解决率",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="分布分析")
     * )
     */
    public function categories(Request $request)
    {
        $tenantId = app('currentTenantId');
        $start = $request->input('start_date', now()->subDays(30)->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));

        $data = app('report.service')->getCategoryDistribution($start, $end);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/trends",
     *     tags={"Reports"},
     *     summary="工单量趋势预测",
     *     description="线性回归算法：星期均值*0.7+趋势分量*0.3，输出7日预测+置信度",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Parameter(name="predict_days", in="query", @OA\Schema(type="integer", default=7)),
     *     @OA\Response(response=200, description="历史+预测数据")
     * )
     */
    public function trends(Request $request)
    {
        $tenantId = app('currentTenantId');
        $historyDays = $request->input('history_days', 30);
        $predictDays = (int)$request->input('predict_days', 7);

        $data = app('report.service')->getTrendForecast($historyDays, $predictDays);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/insights",
     *     tags={"Reports"},
     *     summary="智能运营建议",
     *     description="基于趋势的AI建议：高峰日增派人力/积压预警/积压消化进展",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(response=200, description="建议列表")
     * )
     */
    public function insights(Request $request)
    {
        $data = app('report.service')->getSmartInsights();

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/reports/billing",
     *     tags={"Reports"},
     *     summary="账单报表",
     *     description="已付/未付/逾期账单+月使用明细",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Parameter(name="status", in="query", description="pending/paid/overdue"),
     *     @OA\Response(response=200, description="账单数据")
     * )
     */
    public function billing(Request $request)
    {
        $tenantId = app('currentTenantId');
        $status = $request->input('status');
        $start = $request->input('start_date', now()->subYear()->format('Y-m-d'));
        $end = $request->input('end_date', now()->format('Y-m-d'));

        $data = app('report.service')->getBillingReport($tenantId, $start, $end, $status);

        return response()->json([
            'success' => true,
            'code' => 200,
            'data' => $data,
        ]);
    }
}
