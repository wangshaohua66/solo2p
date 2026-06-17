<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (empty($permissions)) {
            return $next($request);
        }

        $user = Auth::user();
        $apiKey = $request->attributes->get('api_key');

        if ($user && $user->isOwner()) {
            return $next($request);
        }

        foreach ($permissions as $permission) {
            if ($this->hasPermission($user, $apiKey, $permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => '权限不足，无法执行此操作',
            'code' => 403,
            'required_permissions' => $permissions,
        ], 403);
    }

    protected function hasPermission($user, $apiKey, string $permission): bool
    {
        if ($apiKey instanceof ApiKey) {
            if (!$apiKey->hasScope($permission)) {
                return false;
            }
            if ($apiKey->user_id) {
                $keyUser = \App\Models\User::find($apiKey->user_id);
                return $keyUser && $keyUser->hasPermission($permission);
            }
            return true;
        }

        if ($user) {
            return $user->hasPermission($permission);
        }

        return false;
    }
}
