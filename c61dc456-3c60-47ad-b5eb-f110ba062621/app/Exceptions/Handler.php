<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->renderable(function (Throwable $e, $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return response()->json([
                    'code' => 422,
                    'message' => $e->getMessage(),
                    'data' => $e->errors(),
                ], 422);
            }

            if ($e instanceof ModelNotFoundException) {
                return response()->json([
                    'code' => 404,
                    'message' => '资源不存在',
                    'data' => null,
                ], 404);
            }

            if ($e instanceof NotFoundHttpException) {
                return response()->json([
                    'code' => 404,
                    'message' => '接口不存在',
                    'data' => null,
                ], 404);
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'code' => 401,
                    'message' => '未登录或登录已过期',
                    'data' => null,
                ], 401);
            }

            return null;
        });
    }

    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'code' => 401,
                'message' => '未登录或登录已过期',
                'data' => null,
            ], 401);
        }

        return redirect()->guest(route('login'));
    }
}
