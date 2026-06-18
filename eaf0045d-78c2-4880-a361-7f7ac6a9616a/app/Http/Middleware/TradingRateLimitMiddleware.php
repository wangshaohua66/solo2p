<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class TradingRateLimitMiddleware
{
    const GLOBAL_QPS_LIMIT = 500;
    const PER_USER_QPS_LIMIT = 100;
    const GLOBAL_WINDOW_SECONDS = 1;
    const PER_USER_WINDOW_SECONDS = 60;

    public function handle(Request $request, Closure $next)
    {
        $key = $this->resolveRequestSignature($request);

        $globalTooMany = $this->checkGlobalRateLimit();
        if ($globalTooMany) {
            return $this->buildResponse(
                '系统繁忙，请稍后重试',
                self::GLOBAL_QPS_LIMIT,
                self::GLOBAL_WINDOW_SECONDS
            );
        }

        $userTooMany = !RateLimiter::attempt(
            $key,
            self::PER_USER_QPS_LIMIT * self::PER_USER_WINDOW_SECONDS,
            function () {},
            self::PER_USER_WINDOW_SECONDS
        );

        if ($userTooMany) {
            return $this->buildResponse(
                '请求过于频繁，请稍后重试',
                self::PER_USER_QPS_LIMIT,
                self::PER_USER_WINDOW_SECONDS
            );
        }

        $response = $next($request);

        $response->headers->set('X-RateLimit-Limit', self::PER_USER_QPS_LIMIT * self::PER_USER_WINDOW_SECONDS);
        $response->headers->set(
            'X-RateLimit-Remaining',
            max(0, RateLimiter::remaining($key, self::PER_USER_QPS_LIMIT * self::PER_USER_WINDOW_SECONDS))
        );

        return $response;
    }

    protected function checkGlobalRateLimit(): bool
    {
        $windowKey = 'global_trade_qps:' . now()->timestamp;

        $current = Cache::add($windowKey, 0, 2) ? 0 : Cache::get($windowKey, 0);

        if ($current >= self::GLOBAL_QPS_LIMIT) {
            return true;
        }

        Cache::increment($windowKey);

        return false;
    }

    protected function resolveRequestSignature(Request $request): string
    {
        $userId = $request->user()?->id;

        if ($userId) {
            return 'user:' . $userId;
        }

        return 'ip:' . $request->ip();
    }

    protected function buildResponse(string $message, int $limit, int $retryAfter): Response
    {
        return response()->json([
            'code' => 429,
            'message' => $message,
            'errors' => [
                'limit' => $limit,
                'retry_after' => $retryAfter,
            ],
        ], 429, [
            'Retry-After' => $retryAfter,
            'X-RateLimit-Limit' => $limit,
            'X-RateLimit-Remaining' => 0,
        ]);
    }
}
