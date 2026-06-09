<?php

use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

function getExceptionStatusCode(Throwable $e): int
{
    if ($e instanceof HttpExceptionInterface) {
        return $e->getStatusCode();
    }

    $statusMap = [
        \Illuminate\Validation\ValidationException::class => 422,
        \Illuminate\Auth\AuthenticationException::class => 401,
        \Illuminate\Auth\Access\AuthorizationException::class => 403,
        \Illuminate\Database\Eloquent\ModelNotFoundException::class => 404,
        \Symfony\Component\Routing\Exception\RouteNotFoundException::class => 404,
        \Illuminate\Session\TokenMismatchException::class => 419,
    ];

    foreach ($statusMap as $class => $code) {
        if ($e instanceof $class) {
            return $code;
        }
    }

    return 500;
}

function getExceptionTitle(Throwable $e, int $statusCode): string
{
    $titles = [
        400 => 'Bad Request',
        401 => 'Unauthorized',
        402 => 'Payment Required',
        403 => 'Forbidden',
        404 => 'Not Found',
        405 => 'Method Not Allowed',
        406 => 'Not Acceptable',
        408 => 'Request Timeout',
        409 => 'Conflict',
        410 => 'Gone',
        411 => 'Length Required',
        412 => 'Precondition Failed',
        413 => 'Payload Too Large',
        414 => 'URI Too Long',
        415 => 'Unsupported Media Type',
        416 => 'Range Not Satisfiable',
        417 => 'Expectation Failed',
        418 => 'I\'m a teapot',
        422 => 'Unprocessable Entity',
        423 => 'Locked',
        424 => 'Failed Dependency',
        425 => 'Too Early',
        426 => 'Upgrade Required',
        428 => 'Precondition Required',
        429 => 'Too Many Requests',
        431 => 'Request Header Fields Too Large',
        451 => 'Unavailable For Legal Reasons',
        500 => 'Internal Server Error',
        501 => 'Not Implemented',
        502 => 'Bad Gateway',
        503 => 'Service Unavailable',
        504 => 'Gateway Timeout',
        505 => 'HTTP Version Not Supported',
        506 => 'Variant Also Negotiates',
        507 => 'Insufficient Storage',
        508 => 'Loop Detected',
        510 => 'Not Extended',
        511 => 'Network Authentication Required',
    ];

    return $titles[$statusCode] ?? 'Error';
}

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->statefulApi();
        $middleware->throttleApi();
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
                $statusCode = getExceptionStatusCode($e);
                $title = getExceptionTitle($e, $statusCode);
                
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
    ->booted(function () {
        Event::listen(ConnectionEstablished::class, function (ConnectionEstablished $event) {
            if ($event->connection->getDriverName() === 'sqlite') {
                DB::statement('PRAGMA journal_mode = WAL;');
                DB::statement('PRAGMA synchronous = NORMAL;');
                DB::statement('PRAGMA busy_timeout = 30000;');
            }
        });
    })
    ->create();
