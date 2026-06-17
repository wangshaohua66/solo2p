<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use App\Models\Tenant;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Passport\Http\Middleware\CheckClientCredentials;
use Symfony\Component\HttpFoundation\Response;

class ApiAuthentication
{
    public function handle(Request $request, Closure $next): Response
    {
        $authMode = $this->detectAuthMode($request);

        switch ($authMode) {
            case 'bearer':
                return $this->handleBearerAuth($request, $next);

            case 'apikey':
                return $this->handleApiKeyAuth($request, $next);

            case 'basic':
                return $this->handleBasicAuth($request, $next);

            default:
                return response()->json([
                    'success' => false,
                    'message' => '未提供有效的认证凭证',
                    'code' => 401,
                ], 401);
        }
    }

    protected function detectAuthMode(Request $request): ?string
    {
        $authHeader = $request->header('Authorization', '');

        if (str_starts_with($authHeader, 'Bearer ')) {
            return 'bearer';
        }
        if (str_starts_with($authHeader, 'Basic ')) {
            return 'basic';
        }
        if ($request->header('X-API-Key') || $request->query('api_key')) {
            return 'apikey';
        }

        return null;
    }

    protected function handleBearerAuth(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization', '');
        $token = trim(substr($authHeader, 7));

        if (str_starts_with($token, 'tk_')) {
            $apiKey = ApiKey::where('key', $token)->first();
            if (!$apiKey || !$apiKey->isActive()) {
                return $this->unauthorizedResponse('API Key无效或已失效');
            }
            if (!$apiKey->isIpAllowed($request->ip())) {
                return $this->forbiddenResponse('IP地址不在允许列表中');
            }
            if ($apiKey->isRateLimited($request->ip())) {
                return $this->rateLimitResponse();
            }
            $apiKey->incrementRequests();

            $this->setTenantContext($apiKey->tenant_id);
            $this->setUserContext($apiKey->user_id);

            $request->attributes->set('auth_mode', 'apikey_bearer');
            $request->attributes->set('api_key', $apiKey);

            return $next($request);
        }

        if (Auth::guard('api')->check()) {
            $user = Auth::guard('api')->user();
            if (!$user || !$user->isActive()) {
                return $this->unauthorizedResponse('用户账户已失效');
            }
            $tenant = Tenant::find($user->tenant_id);
            if (!$tenant || !$tenant->isActive()) {
                return $this->forbiddenResponse('租户已被停用');
            }
            $this->setTenantContext($user->tenant_id);
            $this->setUserContext($user->id);
            $user->update(['last_active_at' => now()]);

            $request->attributes->set('auth_mode', 'oauth2');
            return $next($request);
        }

        return $this->unauthorizedResponse('OAuth2令牌无效或已过期');
    }

    protected function handleApiKeyAuth(Request $request, Closure $next): Response
    {
        $key = $request->header('X-API-Key') ?: $request->query('api_key');
        $signature = $request->header('X-API-Signature', '');

        $apiKey = ApiKey::where('key', $key)->first();
        if (!$apiKey || !$apiKey->isActive()) {
            return $this->unauthorizedResponse('API Key无效或已失效');
        }
        if (!$apiKey->isIpAllowed($request->ip())) {
            return $this->forbiddenResponse('IP地址不在允许列表中');
        }
        if ($signature && !$apiKey->validateSignature($request->getContent(), $signature)) {
            return $this->forbiddenResponse('请求签名验证失败');
        }
        if ($apiKey->isRateLimited($request->ip())) {
            return $this->rateLimitResponse();
        }
        $apiKey->incrementRequests();

        $tenant = Tenant::find($apiKey->tenant_id);
        if (!$tenant || !$tenant->isActive()) {
            return $this->forbiddenResponse('租户已被停用');
        }

        $this->setTenantContext($apiKey->tenant_id);
        $this->setUserContext($apiKey->user_id);

        $request->attributes->set('auth_mode', 'apikey');
        $request->attributes->set('api_key', $apiKey);

        return $next($request);
    }

    protected function handleBasicAuth(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization', '');
        $credentials = base64_decode(substr($authHeader, 6));
        [$email, $password] = explode(':', $credentials, 2) + [null, null];

        if (!$email || !$password) {
            return $this->unauthorizedResponse('Basic Auth格式错误');
        }

        [$tenantSubdomain, $actualEmail] = str_contains($email, '+')
            ? explode('+', $email, 2)
            : [null, $email];

        $query = User::where('email', $actualEmail);
        if ($tenantSubdomain) {
            $query->whereHas('tenant', fn ($q) => $q->where('subdomain', $tenantSubdomain));
        }

        $user = $query->first();
        if (!$user || !\Hash::check($password, $user->password)) {
            return $this->unauthorizedResponse('邮箱或密码错误');
        }
        if (!$user->isActive()) {
            return $this->forbiddenResponse('用户账户已被停用');
        }
        $tenant = Tenant::find($user->tenant_id);
        if (!$tenant || !$tenant->isActive()) {
            return $this->forbiddenResponse('租户已被停用');
        }

        $this->setTenantContext($user->tenant_id);
        Auth::setUser($user);
        $user->update(['last_active_at' => now()]);

        $request->attributes->set('auth_mode', 'basic');
        return $next($request);
    }

    protected function setTenantContext(int $tenantId): void
    {
        app()->instance('currentTenantId', $tenantId);
        if (!app()->bound('currentTenant')) {
            $tenant = Tenant::find($tenantId);
            app()->instance('currentTenant', $tenant);
        }
    }

    protected function setUserContext(?int $userId): void
    {
        if ($userId && !Auth::check()) {
            $user = User::find($userId);
            if ($user) {
                Auth::setUser($user);
            }
        }
    }

    protected function unauthorizedResponse(string $message): Response
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 401,
        ], 401);
    }

    protected function forbiddenResponse(string $message): Response
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            'code' => 403,
        ], 403);
    }

    protected function rateLimitResponse(): Response
    {
        return response()->json([
            'success' => false,
            'message' => '请求过于频繁，请稍后重试',
            'code' => 429,
        ], 429, ['Retry-After' => 60]);
    }
}
