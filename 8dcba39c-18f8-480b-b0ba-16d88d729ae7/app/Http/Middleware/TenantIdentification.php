<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class TenantIdentification
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->bound('currentTenantId')) {
            return $next($request);
        }

        $tenant = $this->resolveTenant($request);

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => '无法识别租户信息',
                'code' => 400,
            ], 400);
        }

        if (!$tenant->isActive()) {
            return response()->json([
                'success' => false,
                'message' => $tenant->isSuspended() ? '租户已被暂停' : '租户已注销',
                'code' => 403,
                'details' => [
                    'tenant_status' => $tenant->status,
                    'subscription_ends_at' => optional($tenant->subscription_ends_at)->toIso8601String(),
                ],
            ], 403);
        }

        app()->instance('currentTenantId', $tenant->id);
        app()->instance('currentTenant', $tenant);

        date_default_timezone_set($tenant->timezone);

        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }

    protected function resolveTenant(Request $request): ?Tenant
    {
        $resolvers = [
            'header' => fn () => $this->fromHeader($request),
            'subdomain' => fn () => $this->fromSubdomain($request),
            'path' => fn () => $this->fromPath($request),
            'query' => fn () => $this->fromQuery($request),
        ];

        foreach ($resolvers as $resolver) {
            $tenant = $resolver();
            if ($tenant) {
                return $tenant;
            }
        }

        return null;
    }

    protected function fromHeader(Request $request): ?Tenant
    {
        $tenantId = $request->header('X-Tenant-ID');
        if ($tenantId) {
            return $this->findTenantById((int) $tenantId);
        }
        $subdomain = $request->header('X-Tenant-Subdomain');
        if ($subdomain) {
            return $this->findTenantBySubdomain($subdomain);
        }
        return null;
    }

    protected function fromSubdomain(Request $request): ?Tenant
    {
        $host = $request->getHost();
        $parts = explode('.', $host);

        if (count($parts) >= 3) {
            $subdomain = $parts[0];
            $validRoots = config('saas.root_domains', ['localhost', 'ticketsaas.com', 'app.ticketsaas.com']);
            $rootDomain = implode('.', array_slice($parts, -2));

            if (in_array($rootDomain, $validRoots) && $subdomain !== 'www' && $subdomain !== 'app') {
                return $this->findTenantBySubdomain($subdomain);
            }
        }

        return null;
    }

    protected function fromPath(Request $request): ?Tenant
    {
        $tenantUuid = $request->route('tenant_uuid');
        if ($tenantUuid) {
            return $this->findTenantByUuid($tenantUuid);
        }
        $path = $request->path();
        if (preg_match('#^api/v[0-9]+/tenants/([a-f0-9\-]{36})#i', $path, $matches)) {
            return $this->findTenantByUuid($matches[1]);
        }
        return null;
    }

    protected function fromQuery(Request $request): ?Tenant
    {
        $tenantId = $request->query('tenant_id');
        if ($tenantId) {
            return $this->findTenantById((int) $tenantId);
        }
        $subdomain = $request->query('subdomain');
        if ($subdomain) {
            return $this->findTenantBySubdomain($subdomain);
        }
        return null;
    }

    protected function findTenantById(int $id): ?Tenant
    {
        return Cache::remember("tenant:id:{$id}", 3600, fn () => Tenant::find($id));
    }

    protected function findTenantByUuid(string $uuid): ?Tenant
    {
        return Cache::remember("tenant:uuid:{$uuid}", 3600, fn () => Tenant::where('uuid', $uuid)->first());
    }

    protected function findTenantBySubdomain(string $subdomain): ?Tenant
    {
        return Cache::remember("tenant:subdomain:{$subdomain}", 3600, fn () => Tenant::where('subdomain', $subdomain)->first());
    }
}
