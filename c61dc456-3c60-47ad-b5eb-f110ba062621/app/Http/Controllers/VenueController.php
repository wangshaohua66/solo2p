<?php

namespace App\Http\Controllers;

use App\Models\Venue;
use App\Models\Court;
use App\Services\AvailabilityService;
use App\Services\ReportService;
use Illuminate\Http\Request;

/**
 * @OA\Tag(name="场馆管理", description="场馆CRUD与场地配置")
 */
class VenueController extends Controller
{
    protected AvailabilityService $availabilityService;
    protected ReportService $reportService;

    public function __construct(AvailabilityService $availabilityService, ReportService $reportService)
    {
        $this->availabilityService = $availabilityService;
        $this->reportService = $reportService;
    }

    /**
     * @OA\Get(
     *     path="/api/venues",
     *     summary="获取场馆列表",
     *     description="分页获取活跃场馆列表，支持按类型和关键词筛选",
     *     tags={"场馆管理"},
     *     @OA\Parameter(name="type", in="query", description="场馆类型", required=false, @OA\Schema(type="string")),
     *     @OA\Parameter(name="keyword", in="query", description="搜索关键词(按名称模糊匹配)", required=false, @OA\Schema(type="string")),
     *     @OA\Parameter(name="per_page", in="query", description="每页条数", required=false, @OA\Schema(type="integer", default=20)),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="total", type="integer", example=50),
     *                 @OA\Property(property="page", type="integer", example=1),
     *                 @OA\Property(property="per_page", type="integer", example=20),
     *                 @OA\Property(
     *                     property="list",
     *                     type="array",
     *                     @OA\Items(
     *                         type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="name", type="string", example="阳光体育馆"),
     *                         @OA\Property(property="type", type="string", example="羽毛球"),
     *                         @OA\Property(property="address", type="string", example="北京市朝阳区xxx"),
     *                         @OA\Property(property="is_active", type="boolean", example=true)
     *                     )
     *                 )
     *             )
     *         )
     *     )
     * )
     */
    public function index(Request $request)
    {
        $query = Venue::where('is_active', true);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('keyword')) {
            $query->where('name', 'like', '%' . $request->keyword . '%');
        }

        $venues = $query->orderBy('id', 'desc')->paginate($request->per_page ?? 20);

        return $this->success([
            'total' => $venues->total(),
            'page' => $venues->currentPage(),
            'per_page' => $venues->perPage(),
            'list' => $venues->items(),
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/venues/{id}",
     *     summary="获取场馆详情",
     *     description="根据ID获取场馆详细信息，包含活跃场地数量",
     *     tags={"场馆管理"},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="name", type="string", example="阳光体育馆"),
     *                 @OA\Property(property="type", type="string", example="羽毛球"),
     *                 @OA\Property(property="description", type="string", example="专业羽毛球馆"),
     *                 @OA\Property(property="address", type="string", example="北京市朝阳区xxx"),
     *                 @OA\Property(property="contact_phone", type="string", example="010-12345678"),
     *                 @OA\Property(property="open_time", type="string", example="08:00"),
     *                 @OA\Property(property="close_time", type="string", example="22:00"),
     *                 @OA\Property(property="slot_duration", type="integer", example=60),
     *                 @OA\Property(property="base_price", type="number", example=50.00),
     *                 @OA\Property(property="peak_price", type="number", example=80.00),
     *                 @OA\Property(property="courts_count", type="integer", example=6)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="场馆不存在",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="No query results for model [App\\Models\\Venue]"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function show($id)
    {
        $venue = Venue::withCount(['courts' => function ($q) {
            $q->where('is_active', true);
        }])->findOrFail($id);

        return $this->success($venue);
    }

    /**
     * @OA\Post(
     *     path="/api/venues",
     *     summary="创建场馆",
     *     description="管理员创建新场馆",
     *     tags={"场馆管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"name", "type", "open_time", "close_time", "slot_duration", "base_price", "peak_price"},
     *                 @OA\Property(property="name", type="string", description="场馆名称(最长100)", example="阳光体育馆"),
     *                 @OA\Property(property="type", type="string", description="场馆类型(最长30)", example="羽毛球"),
     *                 @OA\Property(property="description", type="string", description="场馆描述", example="专业羽毛球馆"),
     *                 @OA\Property(property="address", type="string", description="场馆地址(最长255)", example="北京市朝阳区xxx"),
     *                 @OA\Property(property="contact_phone", type="string", description="联系电话(最长20)", example="010-12345678"),
     *                 @OA\Property(property="open_time", type="string", description="营业开始时间(H:i)", example="08:00"),
     *                 @OA\Property(property="close_time", type="string", description="营业结束时间(H:i，须晚于open_time)", example="22:00"),
     *                 @OA\Property(property="slot_duration", type="integer", description="时段时长(分钟，30-180)", example=60),
     *                 @OA\Property(property="base_price", type="number", description="基础价格", example=50.00),
     *                 @OA\Property(property="peak_price", type="number", description="高峰价格", example=80.00),
     *                 @OA\Property(property="peak_hours", type="array", description="高峰时段", @OA\Items(type="string"), example={"18:00-20:00"}),
     *                 @OA\Property(property="advance_booking_days", type="integer", description="提前预约天数(1-30)", example=7),
     *                 @OA\Property(property="daily_booking_limit", type="integer", description="每日预约上限(1-10)", example=3)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="创建成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="场馆创建成功"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="name", type="string", example="阳光体育馆"),
     *                 @OA\Property(property="type", type="string", example="羽毛球"),
     *                 @OA\Property(property="is_active", type="boolean", example=true)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="验证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="验证失败"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'type' => 'required|string|max:30',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:20',
            'open_time' => 'required|date_format:H:i',
            'close_time' => 'required|date_format:H:i|after:open_time',
            'slot_duration' => 'required|integer|min:30|max:180',
            'base_price' => 'required|numeric|min:0',
            'peak_price' => 'required|numeric|min:0',
            'peak_hours' => 'nullable|array',
            'advance_booking_days' => 'integer|min:1|max:30',
            'daily_booking_limit' => 'integer|min:1|max:10',
        ]);

        $validated['peak_hours'] = isset($validated['peak_hours']) ? json_encode($validated['peak_hours']) : null;

        $venue = Venue::create($validated);

        return $this->success($venue, '场馆创建成功');
    }

    /**
     * @OA\Put(
     *     path="/api/venues/{id}",
     *     summary="更新场馆",
     *     description="管理员更新场馆信息，所有字段均为可选(sometimes)",
     *     tags={"场馆管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 @OA\Property(property="name", type="string", description="场馆名称(最长100)", example="阳光体育馆"),
     *                 @OA\Property(property="type", type="string", description="场馆类型(最长30)", example="羽毛球"),
     *                 @OA\Property(property="description", type="string", description="场馆描述", example="专业羽毛球馆"),
     *                 @OA\Property(property="address", type="string", description="场馆地址(最长255)", example="北京市朝阳区xxx"),
     *                 @OA\Property(property="contact_phone", type="string", description="联系电话(最长20)", example="010-12345678"),
     *                 @OA\Property(property="open_time", type="string", description="营业开始时间(H:i)", example="08:00"),
     *                 @OA\Property(property="close_time", type="string", description="营业结束时间(H:i)", example="22:00"),
     *                 @OA\Property(property="slot_duration", type="integer", description="时段时长(分钟，30-180)", example=60),
     *                 @OA\Property(property="base_price", type="number", description="基础价格", example=50.00),
     *                 @OA\Property(property="peak_price", type="number", description="高峰价格", example=80.00),
     *                 @OA\Property(property="peak_hours", type="array", description="高峰时段", @OA\Items(type="string"), example={"18:00-20:00"}),
     *                 @OA\Property(property="advance_booking_days", type="integer", description="提前预约天数(1-30)", example=7),
     *                 @OA\Property(property="daily_booking_limit", type="integer", description="每日预约上限(1-10)", example=3),
     *                 @OA\Property(property="is_active", type="boolean", description="是否启用", example=true)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="更新成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="场馆更新成功"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="name", type="string", example="阳光体育馆"),
     *                 @OA\Property(property="type", type="string", example="羽毛球"),
     *                 @OA\Property(property="is_active", type="boolean", example=true)
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="场馆不存在",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="No query results for model [App\\Models\\Venue]"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="验证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="验证失败"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function update(Request $request, $id)
    {
        $venue = Venue::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'type' => 'sometimes|string|max:30',
            'description' => 'nullable|string',
            'address' => 'nullable|string|max:255',
            'contact_phone' => 'nullable|string|max:20',
            'open_time' => 'sometimes|date_format:H:i',
            'close_time' => 'sometimes|date_format:H:i',
            'slot_duration' => 'sometimes|integer|min:30|max:180',
            'base_price' => 'sometimes|numeric|min:0',
            'peak_price' => 'sometimes|numeric|min:0',
            'peak_hours' => 'nullable|array',
            'advance_booking_days' => 'integer|min:1|max:30',
            'daily_booking_limit' => 'integer|min:1|max:10',
            'is_active' => 'boolean',
        ]);

        if (isset($validated['peak_hours'])) {
            $validated['peak_hours'] = json_encode($validated['peak_hours']);
        }

        $venue->update($validated);

        return $this->success($venue, '场馆更新成功');
    }

    /**
     * @OA\Delete(
     *     path="/api/venues/{id}",
     *     summary="停用场馆",
     *     description="软删除(停用)场馆，将is_active设为false",
     *     tags={"场馆管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(
     *         response=200,
     *         description="停用成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="场馆已停用"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="场馆不存在",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="No query results for model [App\\Models\\Venue]"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function destroy($id)
    {
        $venue = Venue::findOrFail($id);
        $venue->update(['is_active' => false]);

        return $this->success(null, '场馆已停用');
    }

    /**
     * @OA\Get(
     *     path="/api/venues/{id}/availability",
     *     summary="获取场馆可用时段",
     *     description="获取指定日期场馆的可用时段列表",
     *     tags={"场馆管理"},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="date", in="query", description="查询日期(Y-m-d格式，默认今天)", required=false, @OA\Schema(type="string", format="date", example="2025-06-17")),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="venue_id", type="integer", example=1),
     *                 @OA\Property(property="venue_name", type="string", example="阳光体育馆"),
     *                 @OA\Property(property="date", type="string", format="date", example="2025-06-17"),
     *                 @OA\Property(
     *                     property="slots",
     *                     type="array",
     *                     @OA\Items(
     *                         type="object",
     *                         @OA\Property(property="time", type="string", example="08:00-09:00"),
     *                         @OA\Property(property="available", type="boolean", example=true),
     *                         @OA\Property(property="price", type="number", example=50.00)
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="日期格式不正确",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="日期格式不正确"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="场馆不存在",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="No query results for model [App\\Models\\Venue]"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function getAvailability(Request $request, $id)
    {
        $date = $request->date ?? date('Y-m-d');
        $venue = Venue::findOrFail($id);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return $this->error('日期格式不正确', 400);
        }

        $slots = $this->availabilityService->getAvailableSlots($id, $date);

        return $this->success([
            'venue_id' => $id,
            'venue_name' => $venue->name,
            'date' => $date,
            'slots' => $slots,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/venues/{id}/courts",
     *     summary="获取场馆场地列表",
     *     description="获取指定场馆下所有活跃场地的列表",
     *     tags={"场馆管理"},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *                 @OA\Items(
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="venue_id", type="integer", example=1),
     *                     @OA\Property(property="court_number", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="1号场"),
     *                     @OA\Property(property="is_active", type="boolean", example=true)
     *                 )
     *             )
     *         )
     *     )
     * )
     */
    public function getCourts($id)
    {
        $courts = Court::where('venue_id', $id)
            ->where('is_active', true)
            ->orderBy('court_number')
            ->get();

        return $this->success($courts);
    }

    /**
     * @OA\Get(
     *     path="/api/venues/{id}/stats",
     *     summary="获取场馆统计",
     *     description="获取指定时间段内场馆的汇总统计和每日统计",
     *     tags={"场馆管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="start_date", in="query", description="开始日期(Y-m-d，默认30天前)", required=false, @OA\Schema(type="string", format="date", example="2025-05-18")),
     *     @OA\Parameter(name="end_date", in="query", description="结束日期(Y-m-d，默认今天)", required=false, @OA\Schema(type="string", format="date", example="2025-06-17")),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="summary",
     *                     type="object",
     *                     @OA\Property(property="total_bookings", type="integer", example=120),
     *                     @OA\Property(property="total_revenue", type="number", example=6000.00),
     *                     @OA\Property(property="occupancy_rate", type="number", example=0.75)
     *                 ),
     *                 @OA\Property(
     *                     property="daily",
     *                     type="array",
     *                     @OA\Items(
     *                         type="object",
     *                         @OA\Property(property="date", type="string", format="date", example="2025-06-17"),
     *                         @OA\Property(property="bookings", type="integer", example=8),
     *                         @OA\Property(property="revenue", type="number", example=400.00)
     *                     )
     *                 )
     *             )
     *         )
     *     )
     * )
     */
    public function stats(Request $request, $id)
    {
        $startDate = $request->start_date ?? date('Y-m-d', strtotime('-30 days'));
        $endDate = $request->end_date ?? date('Y-m-d');

        $stats = $this->reportService->getVenueStats($id, $startDate, $endDate);
        $dailyStats = $this->reportService->getDailyStats($id, $startDate, $endDate);

        return $this->success([
            'summary' => $stats,
            'daily' => $dailyStats,
        ]);
    }

    /**
     * @OA\Get(
     *     path="/api/venues/{id}/time-slot-stats",
     *     summary="获取时段统计",
     *     description="获取指定日期场馆各时段的预订统计数据",
     *     tags={"场馆管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="id", in="path", description="场馆ID", required=true, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="date", in="query", description="查询日期(Y-m-d格式，默认今天)", required=false, @OA\Schema(type="string", format="date", example="2025-06-17")),
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="venue_id", type="integer", example=1),
     *                 @OA\Property(property="date", type="string", format="date", example="2025-06-17"),
     *                 @OA\Property(
     *                     property="slots",
     *                     type="array",
     *                     @OA\Items(
     *                         type="object",
     *                         @OA\Property(property="time", type="string", example="08:00-09:00"),
     *                         @OA\Property(property="total_slots", type="integer", example=6),
     *                         @OA\Property(property="booked_slots", type="integer", example=4),
     *                         @OA\Property(property="occupancy_rate", type="number", example=0.67)
     *                     )
     *                 )
     *             )
     *         )
     *     )
     * )
     */
    public function timeSlotStats(Request $request, $id)
    {
        $date = $request->date ?? date('Y-m-d');

        $stats = $this->reportService->getTimeSlotStats($id, $date);

        return $this->success([
            'venue_id' => $id,
            'date' => $date,
            'slots' => $stats,
        ]);
    }
}
