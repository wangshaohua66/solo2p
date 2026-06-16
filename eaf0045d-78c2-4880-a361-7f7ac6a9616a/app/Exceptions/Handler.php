<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $levels = [
        //
    ];

    protected $dontReport = [
        //
    ];

    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    public function render($request, Throwable $e)
    {
        if ($request->is('api/*')) {
            return $this->renderApiException($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApiException($request, Throwable $e)
    {
        $statusCode = method_exists($e, 'getStatusCode')
            ? $e->getStatusCode()
            : 500;

        if ($e instanceof ValidationException) {
            return response()->json([
                'code' => 422,
                'message' => '数据验证失败',
                'errors' => $e->errors(),
            ], 422);
        }

        $errors = [];
        if (config('app.debug')) {
            $errors = [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
                'trace' => collect($e->getTrace())->take(10)->toArray(),
            ];
        }

        return response()->json([
            'code' => $statusCode,
            'message' => $e->getMessage() ?: '服务器内部错误',
            'errors' => $errors,
        ], $statusCode);
    }
}
