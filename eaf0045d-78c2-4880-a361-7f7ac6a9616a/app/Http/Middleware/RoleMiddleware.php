<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        if (!Auth::check()) {
            return response()->json([
                'code' => 401,
                'message' => '未登录',
                'errors' => [],
            ], 401);
        }

        $user = Auth::user();

        foreach ($roles as $role) {
            if ($user->role === $role) {
                return $next($request);
            }
        }

        return response()->json([
            'code' => 403,
            'message' => '无权限访问',
            'errors' => ['required_roles' => $roles, 'current_role' => $user->role],
        ], 403);
    }
}
