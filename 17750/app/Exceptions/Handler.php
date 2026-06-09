<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $levels = [
    ];

    protected $dontReport = [
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            $traceId = app('request')->headers->get('X-Trace-Id', (string) Str::uuid());
            \Log::error('Exception occurred', [
                'trace_id' => $traceId,
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'exception_class' => get_class($e),
            ]);
        });

        $this->renderable(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                return $this->handleApiException($e, $request);
            }
        });
    }

    protected function handleApiException(Throwable $e, Request $request): \Illuminate\Http\JsonResponse
    {
        $traceId = (string) Str::uuid();
        $statusCode = $this->getStatusCode($e);
        $title = $this->getTitle($e, $statusCode);

        $detail = $e->getMessage();
        if (config('app.debug') && $statusCode >= 500) {
            $detail .= ' File: ' . $e->getFile() . ' Line: ' . $e->getLine();
        }

        $response = [
            'type' => 'https://tools.ietf.org/html/rfc7807',
            'title' => $title,
            'status' => $statusCode,
            'detail' => $detail,
            'instance' => $request->path(),
            'trace_id' => $traceId,
        ];

        if ($e instanceof ValidationException) {
            $response['errors'] = $e->errors();
        }

        return response()->json($response, $statusCode, [
            'Content-Type' => 'application/problem+json',
            'X-Trace-Id' => $traceId,
        ]);
    }

    protected function getStatusCode(Throwable $e): int
    {
        if (method_exists($e, 'getStatusCode')) {
            return $e->getStatusCode();
        }

        if ($e instanceof ValidationException) {
            return 422;
        }

        if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
            return 404;
        }

        if ($e instanceof \Illuminate\Auth\AuthenticationException) {
            return 401;
        }

        if ($e instanceof \Illuminate\Auth\Access\AuthorizationException) {
            return 403;
        }

        if ($e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException) {
            return 404;
        }

        if ($e instanceof \Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException) {
            return 405;
        }

        if ($e instanceof \Illuminate\Http\Exceptions\ThrottleRequestsException) {
            return 429;
        }

        return 500;
    }

    protected function getTitle(Throwable $e, int $statusCode): string
    {
        $titles = [
            400 => 'Bad Request',
            401 => 'Unauthorized',
            403 => 'Forbidden',
            404 => 'Not Found',
            405 => 'Method Not Allowed',
            422 => 'Unprocessable Entity',
            429 => 'Too Many Requests',
            500 => 'Internal Server Error',
            502 => 'Bad Gateway',
            503 => 'Service Unavailable',
            504 => 'Gateway Timeout',
        ];

        return $titles[$statusCode] ?? 'Error';
    }
}
