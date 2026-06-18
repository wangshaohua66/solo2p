<?php

namespace App\Http\Controllers;

use App\Services\BookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * @OA\Tag(name="预约管理", description="场地预约与签到")
 */
class BookingController extends Controller
{
    protected BookingService $bookingService;

    public function __construct(BookingService $bookingService)
    {
        $this->bookingService = $bookingService;
    }

    /**
     * @OA\Get(
     *     path="/api/bookings",
     *     summary="获取用户预约列表",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="status", in="query", description="预约状态", required=false, @OA\Schema(type="string")),
     *     @OA\Parameter(name="venue_id", in="query", description="场地ID", required=false, @OA\Schema(type="integer")),
     *     @OA\Parameter(name="date_from", in="query", description="开始日期", required=false, @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="date_to", in="query", description="结束日期", required=false, @OA\Schema(type="string", format="date")),
     *     @OA\Parameter(name="page", in="query", description="页码", required=false, @OA\Schema(type="integer", default=1)),
     *     @OA\Parameter(name="per_page", in="query", description="每页条数", required=false, @OA\Schema(type="integer", default=20)),
     *
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
    public function index(Request $request)
    {
        $user = $request->user();
        $filters = $request->only(['status', 'venue_id', 'date_from', 'date_to']);
        $page = $request->get('page', 1);
        $perPage = $request->get('per_page', 20);

        $result = $this->bookingService->getUserBookings($user, $filters, $page, $perPage);

        return $this->success($result);
    }

    /**
     * @OA\Get(
     *     path="/api/bookings/{id}",
     *     summary="获取预约详情",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", description="预约ID", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权"),
     *     @OA\Response(response=404, description="未找到")
     * )
     */
    public function show($id)
    {
        $booking = \App\Models\Booking::with(['venue', 'court', 'timeSlot', 'payment'])
            ->where('user_id', Auth::id())
            ->findOrFail($id);

        return $this->success($booking);
    }

    /**
     * @OA\Post(
     *     path="/api/bookings",
     *     summary="创建预约",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"venue_id", "time_slot_id"},
     *             @OA\Property(property="venue_id", type="integer", description="场地ID", example=1),
     *             @OA\Property(property="time_slot_id", type="integer", description="时段ID", example=1)
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=400, description="参数错误"),
     *     @OA\Response(response=401, description="未授权"),
     *     @OA\Response(response=500, description="服务器错误")
     * )
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'venue_id' => 'required|integer|exists:venues,id',
            'time_slot_id' => 'required|integer|exists:time_slots,id',
        ]);

        try {
            $result = $this->bookingService->createBooking(
                $request->user(),
                $validated['venue_id'],
                $validated['time_slot_id']
            );
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 1, null, 500);
        }

        if (!$result['success']) {
            return $this->error($result['message'], 1, null, 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Post(
     *     path="/api/bookings/{id}/cancel",
     *     summary="取消预约",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", description="预约ID", required=true, @OA\Schema(type="integer")),
     *
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
     *     @OA\Response(response=401, description="未授权"),
     *     @OA\Response(response=500, description="服务器错误")
     * )
     */
    public function cancel(Request $request, $id)
    {
        try {
            $result = $this->bookingService->cancelBooking($request->user(), $id);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 1, null, 500);
        }

        if (!$result['success']) {
            return $this->error($result['message'], 1, null, 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Post(
     *     path="/api/bookings/{id}/check-in",
     *     summary="预约签到",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", description="预约ID", required=true, @OA\Schema(type="integer")),
     *
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
     *     @OA\Response(response=401, description="未授权"),
     *     @OA\Response(response=500, description="服务器错误")
     * )
     */
    public function checkIn(Request $request, $id)
    {
        try {
            $result = $this->bookingService->checkIn($request->user(), $id);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 1, null, 500);
        }

        if (!$result['success']) {
            return $this->error($result['message'], 1, null, 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Get(
     *     path="/api/bookings/no/{bookingNo}",
     *     summary="根据预约编号获取预约详情",
     *     tags={"预约管理"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="bookingNo", in="path", description="预约编号", required=true, @OA\Schema(type="string")),
     *
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未授权"),
     *     @OA\Response(response=404, description="未找到")
     * )
     */
    public function getByNo($bookingNo)
    {
        $booking = \App\Models\Booking::with(['venue', 'court', 'timeSlot', 'payment'])
            ->where('booking_no', $bookingNo)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        return $this->success($booking);
    }
}
