<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:api');

Route::prefix('auth')->group(function () {
    Route::post('register', [\App\Http\Controllers\AuthController::class, 'register']);
    Route::post('login', [\App\Http\Controllers\AuthController::class, 'login']);
    Route::post('logout', [\App\Http\Controllers\AuthController::class, 'logout'])->middleware('auth:api');
    Route::post('refresh', [\App\Http\Controllers\AuthController::class, 'refresh'])->middleware('auth:api');
    Route::get('me', [\App\Http\Controllers\AuthController::class, 'me'])->middleware('auth:api');
    Route::post('verify', [\App\Http\Controllers\AuthController::class, 'verify'])->middleware('auth:api');
});

Route::prefix('venues')->group(function () {
    Route::get('/', [\App\Http\Controllers\VenueController::class, 'index']);
    Route::get('{id}', [\App\Http\Controllers\VenueController::class, 'show']);
    Route::post('/', [\App\Http\Controllers\VenueController::class, 'store']);
    Route::put('{id}', [\App\Http\Controllers\VenueController::class, 'update']);
    Route::delete('{id}', [\App\Http\Controllers\VenueController::class, 'destroy']);
    Route::get('{id}/availability', [\App\Http\Controllers\VenueController::class, 'getAvailability']);
    Route::get('{id}/courts', [\App\Http\Controllers\VenueController::class, 'getCourts']);
    Route::get('{id}/stats', [\App\Http\Controllers\VenueController::class, 'stats']);
    Route::get('{id}/time-slot-stats', [\App\Http\Controllers\VenueController::class, 'timeSlotStats']);
});

Route::prefix('bookings')->middleware('auth:api')->group(function () {
    Route::get('/', [\App\Http\Controllers\BookingController::class, 'index']);
    Route::get('{id}', [\App\Http\Controllers\BookingController::class, 'show']);
    Route::post('/', [\App\Http\Controllers\BookingController::class, 'store']);
    Route::post('{id}/cancel', [\App\Http\Controllers\BookingController::class, 'cancel']);
    Route::post('{id}/check-in', [\App\Http\Controllers\BookingController::class, 'checkIn']);
    Route::get('no/{bookingNo}', [\App\Http\Controllers\BookingController::class, 'getByNo']);
});

Route::prefix('payments')->middleware('auth:api')->group(function () {
    Route::post('/', [\App\Http\Controllers\PaymentController::class, 'create']);
    Route::get('{paymentId}/status', [\App\Http\Controllers\PaymentController::class, 'status']);
    Route::post('{paymentId}/refund', [\App\Http\Controllers\PaymentController::class, 'refund']);
});

Route::post('payments/{paymentNo}/callback', [\App\Http\Controllers\PaymentController::class, 'callback']);
Route::get('payments/{paymentNo}/mock-pay', [\App\Http\Controllers\PaymentController::class, 'mockPay']);

Route::prefix('credit')->middleware('auth:api')->group(function () {
    Route::get('info', [\App\Http\Controllers\CreditController::class, 'info']);
    Route::get('records', [\App\Http\Controllers\CreditController::class, 'records']);
});

Route::prefix('admin')->middleware('auth:api')->group(function () {
    Route::get('blacklist', [\App\Http\Controllers\CreditController::class, 'blacklist']);
    Route::post('blacklist', [\App\Http\Controllers\CreditController::class, 'addToBlacklist']);
    Route::delete('blacklist/{userId}', [\App\Http\Controllers\CreditController::class, 'removeFromBlacklist']);
    Route::get('reports/overall', [\App\Http\Controllers\CreditController::class, 'overallReport']);
    Route::get('reports/export', [\App\Http\Controllers\CreditController::class, 'export']);
});
