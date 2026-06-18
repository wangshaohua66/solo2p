<?php

namespace App\Services;

use App\Models\User;
use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PaymentService
{
    protected BookingService $bookingService;

    public function __construct(BookingService $bookingService)
    {
        $this->bookingService = $bookingService;
    }

    public function createPayment(User $user, int $bookingId, string $paymentMethod): array
    {
        return DB::transaction(function () use ($user, $bookingId, $paymentMethod) {
            $booking = Booking::with(['payment'])->findOrFail($bookingId);

            if ($booking->user_id !== $user->id) {
                return [
                    'success' => false,
                    'message' => '无权操作此预约',
                    'data' => null,
                ];
            }

            if ($booking->status === Booking::STATUS_PAID || $booking->status === Booking::STATUS_CHECKED_IN) {
                return [
                    'success' => false,
                    'message' => '该预约已支付',
                    'data' => null,
                ];
            }

            if ($booking->status === Booking::STATUS_CANCELLED) {
                return [
                    'success' => false,
                    'message' => '该预约已取消',
                    'data' => null,
                ];
            }

            if ($booking->isExpired()) {
                $booking->update(['status' => Booking::STATUS_EXPIRED]);
                return [
                    'success' => false,
                    'message' => '预约已过期，请重新预约',
                    'data' => null,
                ];
            }

            $existingPayment = Payment::where('booking_id', $bookingId)
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_PAID])
                ->first();

            if ($existingPayment) {
                if ($existingPayment->status === Payment::STATUS_PAID) {
                    return [
                        'success' => false,
                        'message' => '该预约已支付',
                        'data' => null,
                    ];
                }
                $payment = $existingPayment;
            } else {
                $payment = Payment::create([
                    'user_id' => $user->id,
                    'booking_id' => $bookingId,
                    'payment_method' => $paymentMethod,
                    'amount' => $booking->amount,
                    'status' => Payment::STATUS_PENDING,
                ]);
                $payment->payment_no = $payment->generatePaymentNo();
                $payment->save();
            }

            $payUrl = $this->getPayUrl($payment, $paymentMethod);

            return [
                'success' => true,
                'message' => '支付订单创建成功',
                'data' => [
                    'payment' => $payment,
                    'pay_url' => $payUrl,
                    'expires_at' => $booking->expires_at,
                ],
            ];
        });
    }

    protected function getPayUrl(Payment $payment, string $method): string
    {
        $baseUrl = config('app.url', 'http://localhost');
        return "{$baseUrl}/api/payments/{$payment->payment_no}/mock-pay?method={$method}";
    }

    public function handleCallback(string $paymentNo, array $callbackData): array
    {
        return DB::transaction(function () use ($paymentNo, $callbackData) {
            $payment = Payment::where('payment_no', $paymentNo)->first();

            if (!$payment) {
                return [
                    'success' => false,
                    'message' => '支付记录不存在',
                    'data' => null,
                ];
            }

            if ($payment->status === Payment::STATUS_PAID) {
                return [
                    'success' => true,
                    'message' => '已支付，无需重复处理',
                    'data' => $payment,
                ];
            }

            $transactionId = $callbackData['transaction_id'] ?? 'mock_' . time();
            $success = $callbackData['success'] ?? true;

            if ($success) {
                $payment->markPaid($transactionId, json_encode($callbackData));

                $booking = $payment->booking;
                if ($booking && $booking->status === Booking::STATUS_PENDING) {
                    $booking->update([
                        'status' => Booking::STATUS_PAID,
                        'paid_amount' => $payment->amount,
                    ]);
                }
            } else {
                $payment->update([
                    'status' => Payment::STATUS_FAILED,
                    'callback_data' => json_encode($callbackData),
                ]);
            }

            return [
                'success' => $success,
                'message' => $success ? '支付成功' : '支付失败',
                'data' => $payment->fresh(),
            ];
        });
    }

    public function processRefund(int $paymentId, float $amount, string $reason): array
    {
        return DB::transaction(function () use ($paymentId, $amount, $reason) {
            $payment = Payment::findOrFail($paymentId);

            if (!$payment->isPaid()) {
                return [
                    'success' => false,
                    'message' => '该订单未支付，无法退款',
                    'data' => null,
                ];
            }

            if ($payment->status === Payment::STATUS_REFUNDED) {
                return [
                    'success' => false,
                    'message' => '该订单已退款',
                    'data' => null,
                ];
            }

            if ($amount > (float)$payment->amount) {
                return [
                    'success' => false,
                    'message' => '退款金额不能大于支付金额',
                    'data' => null,
                ];
            }

            $payment->markRefunded($amount, $reason);

            return [
                'success' => true,
                'message' => '退款申请已提交，将在3个工作日内到账',
                'data' => $payment->fresh(),
            ];
        });
    }

    public function mockPay(string $paymentNo): array
    {
        return $this->handleCallback($paymentNo, [
            'success' => true,
            'transaction_id' => 'MOCK' . time() . rand(1000, 9999),
            'paid_at' => Carbon::now()->toDateTimeString(),
            'mock' => true,
        ]);
    }
}
