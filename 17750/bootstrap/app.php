<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();
        $middleware->throttleWithRedis();
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
            'throttle:api',
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $traceId = (string) Str::uuid();
                $statusCode = $this->getStatusCode($e);
                $title = $this->getTitle($e, $statusCode);
                
                $detail = $e->getMessage();
                if (config('app.debug') && $statusCode >= 500) {
                    $detail .= ' File: ' . $e->getFile() . ' Line: ' . $e->getLine();
                }

                return response()->json([
                    'type' => 'https://tools.ietf.org/html/rfc7807',
                    'title' => $title,
                    'status' => $statusCode,
                    'detail' => $detail,
                    'instance' => $request->path(),
                    'trace_id' => $traceId,
                ], $statusCode, [
                    'Content-Type' => 'application/problem+json',
                    'X-Trace-Id' => $traceId,
                ]);
            }
        });

        $exceptions->report(function (Throwable $e) {
            $traceId = app('request')->headers->get('X-Trace-Id', (string) Str::uuid());
            Log::error('Exception occurred', [
                'trace_id' => $traceId,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        });
    })
    ->create();
