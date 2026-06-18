<?php

namespace App\Http\Controllers;

use App\Services\CreditService;
use App\Services\ReportService;
use Illuminate\Http\Request;

/**
 * @OA\Tag(name="信用管理", description="信用积分与黑名单")
 */
class CreditController extends Controller
{
    protected CreditService $creditService;
    protected ReportService $reportService;

    public function __construct(CreditService $creditService, ReportService $reportService)
    {
        $this->creditService = $creditService;
        $this->reportService = $reportService;
    }

    /**
     * @OA\Get(
     *     path="/api/credit/info",
     *     summary="获取用户信用积分信息",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function info(Request $request)
    {
        $info = $this->creditService->getUserCreditInfo($request->user());

        return $this->success($info);
    }

    /**
     * @OA\Get(
     *     path="/api/credit/records",
     *     summary="获取信用记录（分页）",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="type", in="query", description="记录类型", @OA\Schema(type="string")),
     *     @OA\Parameter(name="is_violation", in="query", description="是否违规", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="date_from", in="query", description="起始日期", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="date_to", in="query", description="截止日期", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="page", in="query", description="页码", @OA\Schema(type="integer", default=1)),
     *     @OA\Parameter(name="per_page", in="query", description="每页条数", @OA\Schema(type="integer", default=20)),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function records(Request $request)
    {
        $filters = $request->only(['type', 'is_violation', 'date_from', 'date_to']);
        $page = $request->get('page', 1);
        $perPage = $request->get('per_page', 20);

        $result = $this->creditService->getRecords($request->user(), $filters, $page, $perPage);

        return $this->success($result);
    }

    /**
     * @OA\Get(
     *     path="/api/admin/blacklist",
     *     summary="获取黑名单用户列表",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="page", in="query", description="页码", @OA\Schema(type="integer", default=1)),
     *     @OA\Parameter(name="per_page", in="query", description="每页条数", @OA\Schema(type="integer", default=20)),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function blacklist(Request $request)
    {
        $page = $request->get('page', 1);
        $perPage = $request->get('per_page', 20);

        $result = $this->creditService->getBlacklist($page, $perPage);

        return $this->success($result);
    }

    /**
     * @OA\Post(
     *     path="/api/admin/blacklist",
     *     summary="手动添加用户至黑名单",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"user_id", "days", "reason"},
     *             @OA\Property(property="user_id", type="integer", description="用户ID"),
     *             @OA\Property(property="days", type="integer", description="拉黑天数(1-365)"),
     *             @OA\Property(property="reason", type="string", description="拉黑原因")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=400, description="操作失败"),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function addToBlacklist(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'days' => 'required|integer|min:1|max:365',
            'reason' => 'required|string|max:255',
        ]);

        $result = $this->creditService->addToBlacklist(
            $validated['user_id'],
            $validated['days'],
            $validated['reason']
        );

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Delete(
     *     path="/api/admin/blacklist/{userId}",
     *     summary="将用户从黑名单移除",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="userId", in="path", required=true, description="用户ID", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="reason", in="query", description="解除原因", @OA\Schema(type="string")),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=400, description="操作失败"),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function removeFromBlacklist(Request $request, $userId)
    {
        $reason = $request->get('reason', '管理员解除');

        $result = $this->creditService->removeFromBlacklist($userId, $reason);

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Get(
     *     path="/api/admin/reports/overall",
     *     summary="获取系统总体报告",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="start_date", in="query", description="起始日期", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", description="截止日期", @OA\Schema(type="string", format="date")),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function overallReport(Request $request)
    {
        $startDate = $request->get('start_date', date('Y-m-d', strtotime('-30 days')));
        $endDate = $request->get('end_date', date('Y-m-d'));

        $stats = $this->reportService->getOverallStats($startDate, $endDate);

        return $this->success($stats);
    }

    /**
     * @OA\Get(
     *     path="/api/admin/reports/export",
     *     summary="导出报告为CSV",
     *     tags={"信用管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="type", in="query", description="报告类型", @OA\Schema(type="string", default="venue_daily")),
     *     @OA\Parameter(name="venue_id", in="query", description="场馆ID", @OA\Schema(type="integer")),
     *     @OA\Parameter(name="start_date", in="query", description="起始日期", @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="end_date", in="query", description="截止日期", @OA\Schema(type="string", format="date")),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="导出成功"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="filename", type="string", example="report.csv"),
     *                 @OA\Property(property="download_url", type="string", example="/storage/report.csv")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权")
     * )
     */
    public function export(Request $request)
    {
        $type = $request->get('type', 'venue_daily');
        $params = $request->only(['venue_id', 'start_date', 'end_date']);

        $filepath = $this->reportService->exportCsv($type, $params);

        $filename = basename($filepath);

        return $this->success([
            'filename' => $filename,
            'download_url' => url('/storage/' . $filename),
        ], '导出成功');
    }
}
