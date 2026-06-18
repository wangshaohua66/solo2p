<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * @OA\Tag(name="认证", description="用户注册登录与实名认证")
 *
 * @OA\SecurityScheme(
 *     securityScheme="bearerAuth",
 *     type="http",
 *     scheme="bearer",
 *     bearerFormat="JWT",
 *     description="Bearer Token 认证"
 * )
 */
class AuthController extends Controller
{
    /**
     * @OA\Post(
     *     path="/api/auth/register",
     *     summary="用户注册",
     *     description="使用手机号和密码注册新用户，注册成功后返回用户信息和访问令牌",
     *     tags={"认证"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"phone", "password"},
     *                 @OA\Property(property="phone", type="string", description="手机号", example="13800138000"),
     *                 @OA\Property(property="password", type="string", description="密码(6-20位)", example="123456")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="注册成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="user",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="phone", type="string", example="13800138000"),
     *                     @OA\Property(property="is_verified", type="boolean", example=false),
     *                     @OA\Property(property="credit_score", type="integer", example=100)
     *                 ),
     *                 @OA\Property(property="access_token", type="string", example="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."),
     *                 @OA\Property(property="token_type", type="string", example="Bearer")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="验证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="手机号已被注册"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function register(Request $request)
    {
        $validated = $request->validate([
            'phone' => 'required|string|regex:/^1[3-9]\d{9}$/|unique:users',
            'password' => 'required|string|min:6|max:20',
        ]);

        $user = User::create([
            'phone' => $validated['phone'],
            'password' => Hash::make($validated['password']),
            'credit_score' => 100,
        ]);

        $token = $user->createToken('booking-token')->accessToken;

        return $this->success([
            'user' => [
                'id' => $user->id,
                'phone' => $user->phone,
                'is_verified' => $user->is_verified,
                'credit_score' => $user->credit_score,
            ],
            'access_token' => $token,
            'token_type' => 'Bearer',
        ], '注册成功');
    }

    /**
     * @OA\Post(
     *     path="/api/auth/login",
     *     summary="用户登录",
     *     description="使用手机号和密码登录，成功后返回OAuth2访问令牌",
     *     tags={"认证"},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"phone", "password"},
     *                 @OA\Property(property="phone", type="string", description="手机号", example="13800138000"),
     *                 @OA\Property(property="password", type="string", description="密码", example="123456")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="登录成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="user",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="phone", type="string", example="13800138000"),
     *                     @OA\Property(property="real_name", type="string", example=null),
     *                     @OA\Property(property="is_verified", type="boolean", example=false),
     *                     @OA\Property(property="credit_score", type="integer", example=100),
     *                     @OA\Property(property="is_blacklisted", type="boolean", example=false)
     *                 ),
     *                 @OA\Property(property="access_token", type="string", example="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."),
     *                 @OA\Property(property="token_type", type="string", example="Bearer")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="认证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="手机号或密码错误"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function login(Request $request)
    {
        $validated = $request->validate([
            'phone' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('phone', $validated['phone'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return $this->error('手机号或密码错误', 1, null, 401);
        }

        $token = $user->createToken('booking-token')->accessToken;

        return $this->success([
            'user' => [
                'id' => $user->id,
                'phone' => $user->phone,
                'real_name' => $user->real_name,
                'is_verified' => $user->is_verified,
                'credit_score' => $user->credit_score,
                'is_blacklisted' => $user->is_blacklisted,
            ],
            'access_token' => $token,
            'token_type' => 'Bearer',
        ], '登录成功');
    }

    /**
     * @OA\Post(
     *     path="/api/auth/logout",
     *     summary="用户退出登录",
     *     description="撤销当前访问令牌，退出登录",
     *     tags={"认证"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="退出成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(property="data", type="object", example={})
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="未认证",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="Unauthenticated."),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function logout(Request $request)
    {
        $request->user()->token()->revoke();

        return $this->success([], '退出成功');
    }

    /**
     * @OA\Post(
     *     path="/api/auth/refresh",
     *     summary="刷新令牌",
     *     description="撤销当前令牌并生成新的访问令牌",
     *     tags={"认证"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="刷新成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="access_token", type="string", example="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."),
     *                 @OA\Property(property="token_type", type="string", example="Bearer")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="未认证",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="Unauthenticated."),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function refresh(Request $request)
    {
        $user = $request->user();
        $user->token()->revoke();
        $token = $user->createToken('booking-token')->accessToken;

        return $this->success([
            'access_token' => $token,
            'token_type' => 'Bearer',
        ], '刷新成功');
    }

    /**
     * @OA\Get(
     *     path="/api/auth/me",
     *     summary="获取当前用户信息",
     *     description="获取当前已认证用户的详细信息，包括信用分、违规次数、黑名单状态等",
     *     tags={"认证"},
     *     security={{"bearerAuth":{}}},
     *     @OA\Response(
     *         response=200,
     *         description="获取成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="phone", type="string", example="13800138000"),
     *                 @OA\Property(property="real_name", type="string", example="张三"),
     *                 @OA\Property(property="is_verified", type="boolean", example=true),
     *                 @OA\Property(property="credit_score", type="integer", example=100),
     *                 @OA\Property(property="violation_count", type="integer", example=0),
     *                 @OA\Property(property="is_blacklisted", type="boolean", example=false),
     *                 @OA\Property(property="blacklist_until", type="string", format="date-time", example=null),
     *                 @OA\Property(property="discount_rate", type="number", format="float", example=1.0),
     *                 @OA\Property(property="created_at", type="string", format="date-time", example="2025-01-01T00:00:00.000000Z")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="未认证",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="Unauthenticated."),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function me(Request $request)
    {
        $user = $request->user();
        $user->isBlacklisted();

        return $this->success([
            'id' => $user->id,
            'phone' => $user->phone,
            'real_name' => $user->real_name,
            'is_verified' => $user->is_verified,
            'credit_score' => $user->credit_score,
            'violation_count' => $user->violation_count,
            'is_blacklisted' => $user->is_blacklisted,
            'blacklist_until' => $user->blacklist_until,
            'discount_rate' => $user->getDiscountRate(),
            'created_at' => $user->created_at,
        ]);
    }

    /**
     * @OA\Post(
     *     path="/api/auth/verify",
     *     summary="实名认证",
     *     description="使用真实姓名和身份证号进行实名认证，认证后不可修改",
     *     tags={"认证"},
     *     security={{"bearerAuth":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="application/json",
     *             @OA\Schema(
     *                 required={"real_name", "id_card"},
     *                 @OA\Property(property="real_name", type="string", description="真实姓名", example="张三"),
     *                 @OA\Property(property="id_card", type="string", description="身份证号(18位)", example="110101199001011234")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="实名认证成功",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=0),
     *             @OA\Property(property="message", type="string", example="success"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="is_verified", type="boolean", example=true),
     *                 @OA\Property(property="real_name", type="string", example="张三")
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="认证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="实名认证失败：身份证号格式不正确"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="未认证",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="Unauthenticated."),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     ),
     *     @OA\Response(
     *         response=422,
     *         description="验证失败",
     *         @OA\JsonContent(
     *             @OA\Property(property="code", type="integer", example=1),
     *             @OA\Property(property="message", type="string", example="验证失败"),
     *             @OA\Property(property="data", type="null", example=null)
     *         )
     *     )
     * )
     */
    public function verify(Request $request)
    {
        $validated = $request->validate([
            'real_name' => 'required|string|max:50',
            'id_card' => 'required|string|size:18',
        ]);

        $user = $request->user();

        if ($user->is_verified) {
            return $this->error('您已完成实名认证', 400);
        }

        $existing = User::where('id_card', $validated['id_card'])
            ->where('is_verified', true)
            ->first();

        if ($existing) {
            return $this->error('该身份证号已被绑定', 400);
        }

        $verifyResult = $this->verifyIdCard($validated['real_name'], $validated['id_card']);

        if (!$verifyResult['success']) {
            return $this->error('实名认证失败：' . $verifyResult['message'], 400);
        }

        $user->update([
            'real_name' => $validated['real_name'],
            'id_card' => $validated['id_card'],
            'is_verified' => true,
        ]);

        return $this->success([
            'is_verified' => true,
            'real_name' => $user->real_name,
        ], '实名认证成功');
    }

    protected function verifyIdCard(string $name, string $idCard): array
    {
        if (preg_match('/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/', $idCard)) {
            return [
                'success' => true,
                'message' => '验证通过',
            ];
        }

        return [
            'success' => false,
            'message' => '身份证号格式不正确',
        ];
    }
}
