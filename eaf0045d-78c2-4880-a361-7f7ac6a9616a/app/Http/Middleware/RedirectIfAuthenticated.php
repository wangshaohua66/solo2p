<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\RedirectIfAuthenticated as Middleware;

class RedirectIfAuthenticated extends Middleware
{
    public function handle($request, \Closure $next, ...$guards)
    {
        if (empty($guards)) {
            $guards = [null];
        }

        foreach ($guards as $guard) {
            if (auth()->guard($guard)->check()) {
                if ($request->expectsJson()) {
                    return response()->json([
                        'code' => 400,
                        'message' => '已登录',
                        'errors' => [],
                    ], 400);
                }
                return redirect('/home');
            }
        }

        return $next($request);
    }
}
