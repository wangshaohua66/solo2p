<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected AuditLogService $auditLogService;

    public function __construct(AuditLogService $auditLogService)
    {
        $this->auditLogService = $auditLogService;
    }

    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['用户名或密码错误'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'username' => ['账号已被禁用'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        $this->auditLogService->log(
            AuditLogService::BUSINESS_USER,
            AuditLogService::ACTION_LOGIN,
            $user->id,
            null,
            null,
            '用户登录'
        );

        return response()->json([
            'code' => 0,
            'message' => '登录成功',
            'data' => [
                'token' => $token,
                'user' => new UserResource($user),
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'code' => 0,
            'message' => '登出成功',
            'data' => null,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => new UserResource($request->user()),
        ]);
    }
}
