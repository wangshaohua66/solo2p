<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    protected function redirectTo(Request $request): ?string
    {
        return $request->expectsJson() ? null : route('login');
    }

    protected function unauthenticated($request, array $guards)
    {
        if ($request->is('api/*') || $request->wantsJson()) {
            abort(response()->json([
                'success' => false,
                'code' => 401,
                'message' => 'Unauthorized',
                'detail' => 'Authentication required or token expired',
                'timestamp' => now()->toISOString(),
            ], 401));
        }

        parent::unauthenticated($request, $guards);
    }
}
