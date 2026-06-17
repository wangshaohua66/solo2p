<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
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
            if (app()->bound('sentry') && $this->shouldReport($e)) {
                app('sentry')->captureException($e);
            }
        });
    }

    public function render($request, Throwable $e)
    {
        if ($request->is('api/*') || $request->wantsJson()) {
            return $this->renderApiResponse($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApiResponse($request, Throwable $e)
    {
        $response = [
            'success' => false,
            'code' => 500,
            'message' => 'Internal Server Error',
            'data' => null,
            'timestamp' => now()->toISOString(),
        ];

        $statusCode = 500;

        switch (true) {
            case $e instanceof ValidationException:
                $statusCode = 422;
                $response['code'] = 422;
                $response['message'] = 'Validation Failed';
                $response['errors'] = $e->errors();
                break;

            case $e instanceof ModelNotFoundException:
                $statusCode = 404;
                $response['code'] = 404;
                $response['message'] = 'Resource Not Found';
                $ids = $e->getIds();
                $model = class_basename($e->getModel());
                $response['detail'] = "{$model} not found" . ($ids ? ' with id(s): ' . implode(', ', $ids) : '');
                break;

            case $e instanceof NotFoundHttpException:
                $statusCode = 404;
                $response['code'] = 404;
                $response['message'] = 'Endpoint Not Found';
                $response['detail'] = $request->method() . ' ' . $request->getPathInfo();
                break;

            case $e instanceof MethodNotAllowedHttpException:
                $statusCode = 405;
                $response['code'] = 405;
                $response['message'] = 'Method Not Allowed';
                break;

            case $e instanceof AuthenticationException:
                $statusCode = 401;
                $response['code'] = 401;
                $response['message'] = 'Unauthorized';
                $response['detail'] = $e->getMessage() ?: 'Authentication required';
                break;

            case $e instanceof AccessDeniedHttpException:
                $statusCode = 403;
                $response['code'] = 403;
                $response['message'] = 'Forbidden';
                $response['detail'] = 'Insufficient permissions to perform this action';
                break;

            case $e instanceof ThrottleRequestsException:
            case $e instanceof TooManyRequestsHttpException:
                $statusCode = 429;
                $response['code'] = 429;
                $response['message'] = 'Too Many Requests';
                $retryAfter = $e->getHeaders()['Retry-After'] ?? 60;
                $response['detail'] = "Rate limit exceeded. Retry after {$retryAfter} seconds";
                $response['retry_after'] = (int)$retryAfter;
                break;

            case $e instanceof HttpResponseException:
                return $e->getResponse();

            case $e instanceof QueryException:
                $statusCode = 500;
                $response['code'] = 500;
                $response['message'] = 'Database Error';
                if (config('app.debug')) {
                    $response['detail'] = $e->getMessage();
                }
                break;

            default:
                $statusCode = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
                $response['code'] = $statusCode;
                if (method_exists($e, 'getMessage') && $e->getMessage()) {
                    $response['message'] = config('app.debug') ? $e->getMessage() : 'Server Error';
                }
                break;
        }

        if (config('app.debug')) {
            $response['debug'] = [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => collect($e->getTrace())->map(function ($trace) {
                    return [
                        'file' => $trace['file'] ?? null,
                        'line' => $trace['line'] ?? null,
                        'function' => ($trace['class'] ?? '') . ($trace['type'] ?? '') . ($trace['function'] ?? ''),
                    ];
                })->take(15)->toArray(),
            ];
        }

        return response()->json($response, $statusCode);
    }
}
