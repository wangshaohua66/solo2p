<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\CertificateService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CertificateController extends Controller
{
    protected CertificateService $certificateService;

    public function __construct(CertificateService $certificateService)
    {
        $this->certificateService = $certificateService;
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'energy_type' => 'nullable|in:solar,wind',
            'issue_month' => 'nullable|string|size:7',
            'province' => 'nullable|string',
            'owner_id' => 'nullable|integer',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $ownerId = null;

        if ($user->isGenerator()) {
            $ownerId = $user->id;
        } elseif (!empty($validated['owner_id'])) {
            $ownerId = $validated['owner_id'];
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->certificateService->getCertificates(
            $ownerId,
            $validated['energy_type'] ?? null,
            $validated['issue_month'] ?? null,
            $validated['province'] ?? null,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }

    public function balances(Request $request)
    {
        $user = Auth::user();

        $balances = $this->certificateService->getUserBalances($user->id);

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $balances,
        ]);
    }

    public function balance(Request $request, string $energyType)
    {
        $user = Auth::user();

        $balance = $this->certificateService->getBalance($user->id, $energyType);

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => $balance,
        ]);
    }

    public function issue(Request $request)
    {
        $validated = $request->validate([
            'report_month' => 'required|string|size:7',
        ]);

        $user = Auth::user();

        if (!$user->isExchange()) {
            return response()->json([
                'code' => 403,
                'message' => '无核发权限',
                'errors' => [],
            ], 403);
        }

        $result = $this->certificateService->issueCertificates(
            $validated['report_month'],
            $user
        );

        return response()->json([
            'code' => 0,
            'message' => '核发完成',
            'data' => $result,
        ]);
    }

    public function transfers(Request $request)
    {
        $validated = $request->validate([
            'type' => 'nullable|string',
            'energy_type' => 'nullable|in:solar,wind',
            'per_page' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
        ]);

        $user = Auth::user();
        $userId = null;

        if (!$user->isExchange() && !$user->isRegulator()) {
            $userId = $user->id;
        }

        $perPage = $validated['per_page'] ?? 20;
        $page = $validated['page'] ?? 1;

        $result = $this->certificateService->getTransferHistory(
            $userId,
            $validated['type'] ?? null,
            $validated['energy_type'] ?? null,
            $perPage,
            $page
        );

        return response()->json([
            'code' => 0,
            'message' => 'success',
            'data' => [
                'total' => $result->total(),
                'per_page' => $result->perPage(),
                'current_page' => $result->currentPage(),
                'data' => $result->items(),
            ],
        ]);
    }
}
