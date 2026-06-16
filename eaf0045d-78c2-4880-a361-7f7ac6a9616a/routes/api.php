<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\PowerStationController;
use App\Http\Controllers\Api\V1\MeterReadingController;
use App\Http\Controllers\Api\V1\CertificateController;
use App\Http\Controllers\Api\V1\ListingController;
use App\Http\Controllers\Api\V1\ContractController;
use App\Http\Controllers\Api\V1\SettlementController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\ReportController;

Route::prefix('api/v1')->group(function () {

    Route::post('/auth/login', [AuthController::class, 'login'])->name('api.v1.auth.login');

    Route::middleware('auth:sanctum')->group(function () {

        Route::post('/auth/logout', [AuthController::class, 'logout'])->name('api.v1.auth.logout');
        Route::get('/auth/me', [AuthController::class, 'me'])->name('api.v1.auth.me');

        Route::prefix('power-stations')->group(function () {
            Route::get('/', [PowerStationController::class, 'index'])->name('api.v1.power-stations.index');
            Route::post('/', [PowerStationController::class, 'store'])->name('api.v1.power-stations.store');
            Route::get('/{id}', [PowerStationController::class, 'show'])->name('api.v1.power-stations.show');
            Route::put('/{id}', [PowerStationController::class, 'update'])->name('api.v1.power-stations.update');
        });

        Route::prefix('meter-readings')->group(function () {
            Route::get('/', [MeterReadingController::class, 'index'])->name('api.v1.meter-readings.index');
            Route::get('/pending-count', [MeterReadingController::class, 'pendingCount'])->name('api.v1.meter-readings.pending-count');
            Route::post('/submit', [MeterReadingController::class, 'submit'])->name('api.v1.meter-readings.submit');
            Route::post('/{id}/review', [MeterReadingController::class, 'review'])->name('api.v1.meter-readings.review');
            Route::get('/{id}', [MeterReadingController::class, 'show'])->name('api.v1.meter-readings.show');
        });

        Route::prefix('certificates')->group(function () {
            Route::get('/', [CertificateController::class, 'index'])->name('api.v1.certificates.index');
            Route::get('/balances', [CertificateController::class, 'balances'])->name('api.v1.certificates.balances');
            Route::get('/balance/{energyType}', [CertificateController::class, 'balance'])->name('api.v1.certificates.balance');
            Route::post('/issue', [CertificateController::class, 'issue'])->name('api.v1.certificates.issue');
            Route::get('/transfers', [CertificateController::class, 'transfers'])->name('api.v1.certificates.transfers');
        });

        Route::prefix('listings')->group(function () {
            Route::get('/', [ListingController::class, 'index'])->name('api.v1.listings.index');
            Route::post('/', [ListingController::class, 'store'])->name('api.v1.listings.store');
            Route::get('/market-depth', [ListingController::class, 'marketDepth'])->name('api.v1.listings.market-depth');
            Route::get('/trades', [ListingController::class, 'trades'])->name('api.v1.listings.trades');
            Route::get('/latest-price', [ListingController::class, 'latestPrice'])->name('api.v1.listings.latest-price');
            Route::post('/match', [ListingController::class, 'match'])->name('api.v1.listings.match');
            Route::post('/{id}/cancel', [ListingController::class, 'cancel'])->name('api.v1.listings.cancel');
            Route::get('/{id}', [ListingController::class, 'show'])->name('api.v1.listings.show');
        });

        Route::prefix('contracts')->group(function () {
            Route::get('/', [ContractController::class, 'index'])->name('api.v1.contracts.index');
            Route::get('/notifications', [ContractController::class, 'notifications'])->name('api.v1.contracts.notifications');
            Route::get('/notifications/unread-count', [ContractController::class, 'unreadCount'])->name('api.v1.contracts.unread-count');
            Route::post('/notifications/read-all', [ContractController::class, 'markAllNotificationsRead'])->name('api.v1.contracts.mark-all-read');
            Route::post('/notifications/{id}/read', [ContractController::class, 'markNotificationRead'])->name('api.v1.contracts.mark-read');
            Route::post('/{id}/deliver', [ContractController::class, 'deliver'])->name('api.v1.contracts.deliver');
            Route::post('/{id}/confirm-receipt', [ContractController::class, 'confirmReceipt'])->name('api.v1.contracts.confirm-receipt');
            Route::get('/{id}', [ContractController::class, 'show'])->name('api.v1.contracts.show');
        });

        Route::prefix('settlements')->group(function () {
            Route::get('/', [SettlementController::class, 'index'])->name('api.v1.settlements.index');
            Route::get('/monthly-summary', [SettlementController::class, 'monthlySummary'])->name('api.v1.settlements.monthly-summary');
            Route::get('/export-monthly', [SettlementController::class, 'exportMonthly'])->name('api.v1.settlements.export-monthly');
            Route::post('/{id}/confirm', [SettlementController::class, 'confirm'])->name('api.v1.settlements.confirm');
        });

        Route::prefix('audit-logs')->group(function () {
            Route::get('/', [AuditLogController::class, 'index'])->name('api.v1.audit-logs.index');
            Route::get('/{businessType}/{businessId}', [AuditLogController::class, 'byBusiness'])->name('api.v1.audit-logs.by-business');
        });

        Route::prefix('reports')->group(function () {
            Route::get('/quarterly', [ReportController::class, 'quarterly'])->name('api.v1.reports.quarterly');
            Route::get('/dashboard', [ReportController::class, 'dashboard'])->name('api.v1.reports.dashboard');
        });
    });
});
