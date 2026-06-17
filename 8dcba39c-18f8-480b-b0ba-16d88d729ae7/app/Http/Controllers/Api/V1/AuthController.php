<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

/**
 * @OA\Tag(
 *     name="Authentication",
 *     description="认证授权接口 - 登录、登出、令牌刷新、密码重置"
 * )
 */
class AuthController extends Controller
{
    /**
     * @OA\Post(
     *     path="/auth/login",
     *     tags={"Authentication"},
     *     summary="用户登录",
     *     description="使用邮箱+密码获取OAuth2访问令牌，支持子域名格式邮箱(tenant_email)",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","password"},
     *             @OA\Property(property="email", type="string", format="email", example="admin@company1.example.com"),
     *             @OA\Property(property="password", type="string", example="Password@123"),
     *             @OA\Property(property="remember", type="boolean", example=false)
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="登录成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="code", type="integer", example=200),
     *             @OA\Property(property="data", type="object",
     *                 @OA\Property(property="token_type", type="string", example="Bearer"),
     *                 @OA\Property(property="access_token", type="string", example="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."),
     *                 @OA\Property(property="refresh_token", type="string", example="def502009e..."),
     *                 @OA\Property(property="expires_in", type="integer", example=3600),
     *                 @OA\Property(property="user", type="object", ref="#/components/schemas/User")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=401, description="认证失败"),
     *     @OA\Response(response=422, description="参数验证失败"),
     *     @OA\Response(response=429, description="请求过于频繁")
     * )
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string|min:6',
            'remember' => 'boolean',
        ]);

        $user = User::withoutGlobalScopes()
            ->where('email', $request->email)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been disabled.'],
            ]);
        }

        $tenantId = $user->tenant_id;
        app()->instance('currentTenantId', $tenantId);

        $token = $user->createToken('auth_token');
        $expiresIn = 3600;

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Login successful',
            'data' => [
                'token_type' => 'Bearer',
                'access_token' => $token->accessToken,
                'refresh_token' => 'refresh_' . bin2hex(random_bytes(32)),
                'expires_in' => $expiresIn,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenant_id' => $user->tenant_id,
                    'roles' => $user->roles->pluck('name'),
                    'avatar_url' => $user->avatar_url,
                ],
            ],
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/auth/logout",
     *     tags={"Authentication"},
     *     summary="用户登出",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="登出成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Logged out successfully")
     *         )
     *     ),
     *     @OA\Response(response=401, description="未认证")
     * )
     */
    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->token()->revoke();
        }

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Logged out successfully',
            'data' => null,
            'timestamp' => now()->toISOString(),
        ]);
    }

    /**
     * @OA\Post(
     *     path="/auth/refresh",
     *     tags={"Authentication"},
     *     summary="刷新访问令牌",
     *     security={{"OAuth2-Bearer":{}}},
     *     @OA\RequestBody(
     *         @OA\JsonContent(
     *             @OA\Property(property="refresh_token", type="string", example="def502009e...")
     *         )
     *     ),
     *     @OA\Response(response=200, description="刷新成功"),
     *     @OA\Response(response=401, description="令牌无效或过期")
     * )
     */
    public function refresh(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'code' => 401,
                'message' => 'Invalid refresh token',
            ], 401);
        }

        $token = $user->createToken('auth_token');

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => 'Token refreshed',
            'data' => [
                'token_type' => 'Bearer',
                'access_token' => $token->accessToken,
                'refresh_token' => 'refresh_' . bin2hex(random_bytes(32)),
                'expires_in' => 3600,
            ],
        ]);
    }

    /**
     * @OA\Post(
     *     path="/auth/forgot-password",
     *     tags={"Authentication"},
     *     summary="请求密码重置链接",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             @OA\Property(property="email", type="string", format="email", example="user@example.com")
     *         )
     *     ),
     *     @OA\Response(response=200, description="重置邮件已发送"),
     *     @OA\Response(response=422, description="邮箱格式错误")
     * )
     */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        return response()->json([
            'success' => true,
            'code' => 200,
            'message' => $status === Password::RESET_LINK_SENT
                ? 'Password reset email sent if the email exists'
                : 'Request processed',
        ]);
    }

    /**
     * @OA\Post(
     *     path="/auth/reset-password",
     *     tags={"Authentication"},
     *     summary="使用重置令牌设置新密码",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"email","token","password","password_confirmation"},
     *             @OA\Property(property="email", type="string", format="email"),
     *             @OA\Property(property="token", type="string"),
     *             @OA\Property(property="password", type="string", minLength=8),
     *             @OA\Property(property="password_confirmation", type="string")
     *         )
     *     ),
     *     @OA\Response(response=200, description="密码重置成功"),
     *     @OA\Response(response=422, description="令牌无效或密码强度不足")
     * )
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->password = Hash::make($password);
                $user->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'success' => true,
                'code' => 200,
                'message' => 'Password reset successfully',
            ]);
        }

        return response()->json([
            'success' => false,
            'code' => 422,
            'message' => 'Invalid or expired reset token',
        ], 422);
    }
}
