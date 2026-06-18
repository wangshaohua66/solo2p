<?php

namespace App\Http\Controllers;

use App\Services\PaymentService;
use Illuminate\Http\Request;

/**
 * @OA\Tag(name="支付管理", description="支付与退款")
 */
class PaymentController extends Controller
{
    protected PaymentService $paymentService;

    public function __construct(PaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
    }

    /**
     * @OA\Post(
     *     path="/api/payments",
     *     summary="创建支付订单",
     *     tags={"支付管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"booking_id","payment_method"},
     *                 @OA\Property(property="booking_id", type="integer", description="预约ID"),
     *                 @OA\Property(property="payment_method", type="string", enum={"wechat","alipay"}, description="支付方式")
     *             )
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
     *     @OA\Response(response=400, description="参数错误或业务失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=400),
     *             @OA\Property(property="message", type="string", example="error"),
     *             @OA\Property(property="data", type="object", nullable=true)
     *         )
     *     ),
     *     @OA\Response(response=401, description="未认证")
     * )
     */
    public function create(Request $request)
    {
        $validated = $request->validate([
            'booking_id' => 'required|integer|exists:bookings,id',
            'payment_method' => 'required|string|in:wechat,alipay',
        ]);

        $result = $this->paymentService->createPayment(
            $request->user(),
            $validated['booking_id'],
            $validated['payment_method']
        );

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Post(
     *     path="/api/payments/{paymentNo}/callback",
     *     summary="支付回调",
     *     tags={"支付管理"},
     *     @OA\Parameter(name="paymentNo", in="path", required=true, @OA\Schema(type="string"), description="支付编号"),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=400, description="回调处理失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=400),
     *             @OA\Property(property="message", type="string", example="error"),
     *             @OA\Property(property="data", type="object", nullable=true)
     *         )
     *     )
     * )
     */
    public function callback(Request $request, $paymentNo)
    {
        $callbackData = $request->all();

        $result = $this->paymentService->handleCallback($paymentNo, $callbackData);

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Get(
     *     path="/api/payments/{paymentNo}/mock-pay",
     *     summary="模拟支付（仅测试）",
     *     tags={"支付管理"},
     *     @OA\Parameter(name="paymentNo", in="path", required=true, @OA\Schema(type="string"), description="支付编号"),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *     @OA\Response(response=400, description="模拟支付失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=400),
     *             @OA\Property(property="message", type="string", example="error"),
     *             @OA\Property(property="data", type="object", nullable=true)
     *         )
     *     )
     * )
     */
    public function mockPay(Request $request, $paymentNo)
    {
        $result = $this->paymentService->mockPay($paymentNo);

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Post(
     *     path="/api/payments/{paymentId}/refund",
     *     summary="申请退款",
     *     tags={"支付管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="paymentId", in="path", required=true, @OA\Schema(type="integer"), description="支付ID"),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"amount","reason"},
     *                 @OA\Property(property="amount", type="number", format="float", minimum=0.01, description="退款金额"),
     *                 @OA\Property(property="reason", type="string", maxLength=255, description="退款原因")
     *             )
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
     *     @OA\Response(response=400, description="退款失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=400),
     *             @OA\Property(property="message", type="string", example="error"),
     *             @OA\Property(property="data", type="object", nullable=true)
     *         )
     *     ),
     *     @OA\Response(response=401, description="未认证")
     * )
     */
    public function refund(Request $request, $paymentId)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'reason' => 'required|string|max:255',
        ]);

        $result = $this->paymentService->processRefund(
            $paymentId,
            $validated['amount'],
            $validated['reason']
        );

        if (!$result['success']) {
            return $this->error($result['message'], 400);
        }

        return $this->success($result['data'], $result['message']);
    }

    /**
     * @OA\Get(
     *     path="/api/payments/{paymentId}/status",
     *     summary="查询支付状态",
     *     tags={"支付管理"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Parameter(name="paymentId", in="path", required=true, @OA\Schema(type="integer"), description="支付ID"),
     *     @OA\Response(
     *         response=200,
     *         description="成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="payment_id", type="integer", example=1),
     *                 @OA\Property(property="payment_no", type="string", example="PAY20240101000001"),
     *                 @OA\Property(property="status", type="string", example="paid"),
     *                 @OA\Property(property="amount", type="number", format="float", example=100.00),
     *                 @OA\Property(property="paid_at", type="string", format="date-time", nullable=true),
     *                 @OA\Property(property="refund_amount", type="number", format="float", nullable=true, example=0),
     *                 @OA\Property(property="refunded_at", type="string", format="date-time", nullable=true)
     *             )
     *         )
     *     ),
     *     @OA\Response(response=401, description="未认证"),
     *     @OA\Response(response=404, description="支付记录不存在")
     * )
     */
    public function status($paymentId)
    {
        $payment = \App\Models\Payment::with(['booking'])
            ->where('id', $paymentId)
            ->where('user_id', \Illuminate\Support\Facades\Auth::id())
            ->firstOrFail();

        return $this->success([
            'payment_id' => $payment->id,
            'payment_no' => $payment->payment_no,
            'status' => $payment->status,
            'amount' => $payment->amount,
            'paid_at' => $payment->paid_at,
            'refund_amount' => $payment->refund_amount,
            'refunded_at' => $payment->refunded_at,
        ]);
    }
}
