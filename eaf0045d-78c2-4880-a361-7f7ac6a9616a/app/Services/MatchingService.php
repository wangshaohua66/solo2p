<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\Trade;
use App\Models\Contract;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class MatchingService
{
    const MATCHING_CACHE_TTL = 60;

    protected CertificateService $certificateService;
    protected AuditLogService $auditLogService;

    public function __construct(
        CertificateService $certificateService,
        AuditLogService $auditLogService
    ) {
        $this->certificateService = $certificateService;
        $this->auditLogService = $auditLogService;
    }

    public function createListing(
        User $seller,
        string $energyType,
        int $quantity,
        float $unitPrice,
        ?\DateTimeInterface $expiresAt = null,
        ?string $remark = null
    ): Listing {
        if (!$seller->isGenerator() && !$seller->isExchange()) {
            throw new \Exception('无挂牌权限');
        }

        if ($quantity <= 0) {
            throw new \Exception('挂牌数量必须大于0');
        }

        if ($unitPrice <= 0) {
            throw new \Exception('挂牌单价必须大于0');
        }

        $availableBalance = $this->certificateService->getAvailableBalance($seller->id, $energyType);

        if ($availableBalance < $quantity) {
            throw new \Exception("可用绿证余额不足，当前可用：{$availableBalance}张");
        }

        return DB::transaction(function () use (
            $seller,
            $energyType,
            $quantity,
            $unitPrice,
            $expiresAt,
            $remark
        ) {
            $listingNo = 'LST' . date('YmdHis') . rand(1000, 9999);

            $listing = Listing::create([
                'listing_no' => $listingNo,
                'seller_id' => $seller->id,
                'energy_type' => $energyType,
                'total_quantity' => $quantity,
                'available_quantity' => $quantity,
                'traded_quantity' => 0,
                'unit_price' => $unitPrice,
                'status' => Listing::STATUS_ACTIVE,
                'expires_at' => $expiresAt,
                'remark' => $remark,
            ]);

            $this->certificateService->freezeBalance($seller->id, $energyType, $quantity);

            $this->auditLogService->logCreate(
                AuditLogService::BUSINESS_LISTING,
                $listing->id,
                $listing->toArray(),
                '挂牌创建'
            );

            $this->clearMatchingCache($energyType);

            return $listing;
        });
    }

    public function cancelListing(int $listingId, User $operator): Listing
    {
        $listing = Listing::findOrFail($listingId);

        if ($listing->seller_id !== $operator->id && !$operator->isExchange()) {
            throw new \Exception('无撤销权限');
        }

        if (!$listing->canCancel()) {
            throw new \Exception('当前状态不可撤销');
        }

        return DB::transaction(function () use ($listing) {
            $beforeData = $listing->toArray();

            $remainingQuantity = $listing->available_quantity;

            $listing->update([
                'status' => Listing::STATUS_CANCELLED,
                'available_quantity' => 0,
            ]);

            if ($remainingQuantity > 0) {
                $this->certificateService->unfreezeBalance(
                    $listing->seller_id,
                    $listing->energy_type,
                    $remainingQuantity
                );
            }

            $this->auditLogService->logUpdate(
                AuditLogService::BUSINESS_LISTING,
                $listing->id,
                ['status' => $beforeData['status']],
                ['status' => Listing::STATUS_CANCELLED],
                '撤销挂牌'
            );

            $this->clearMatchingCache($listing->energy_type);

            return $listing;
        });
    }

    public function matchOrder(User $buyer, string $energyType, int $quantity, ?float $maxPrice = null): array
    {
        if (!$buyer->isPurchaser() && !$buyer->isExchange()) {
            throw new \Exception('无交易权限');
        }

        if ($quantity <= 0) {
            throw new \Exception('购买数量必须大于0');
        }

        return DB::transaction(function () use ($buyer, $energyType, $quantity, $maxPrice) {
            $listings = $this->getMatchingListings($energyType, $maxPrice);

            $remainingQuantity = $quantity;
            $trades = [];
            $totalTraded = 0;
            $totalAmount = 0;

            foreach ($listings as $listing) {
                if ($remainingQuantity <= 0) {
                    break;
                }

                $tradeQuantity = min($remainingQuantity, $listing->available_quantity);

                if ($tradeQuantity <= 0) {
                    continue;
                }

                $trade = $this->executeTrade($listing, $buyer, $tradeQuantity);

                $trades[] = $trade;
                $totalTraded += $tradeQuantity;
                $totalAmount += $trade->total_amount;
                $remainingQuantity -= $tradeQuantity;
            }

            if ($totalTraded === 0) {
                throw new \Exception('没有可匹配的挂牌单');
            }

            $this->clearMatchingCache($energyType);

            return [
                'trades' => $trades,
                'total_quantity' => $totalTraded,
                'total_amount' => $totalAmount,
                'remaining_quantity' => $remainingQuantity,
            ];
        });
    }

    protected function executeTrade(Listing $listing, User $buyer, int $quantity): Trade
    {
        return DB::transaction(function () use ($listing, $buyer, $quantity) {
            $tradeNo = 'TRD' . date('YmdHis') . rand(1000, 9999);
            $unitPrice = $listing->unit_price;
            $totalAmount = $quantity * $unitPrice;

            $trade = Trade::create([
                'trade_no' => $tradeNo,
                'listing_id' => $listing->id,
                'seller_id' => $listing->seller_id,
                'buyer_id' => $buyer->id,
                'energy_type' => $listing->energy_type,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_amount' => $totalAmount,
                'status' => Trade::STATUS_PENDING,
                'matched_at' => now(),
            ]);

            $newTradedQuantity = $listing->traded_quantity + $quantity;
            $newAvailableQuantity = $listing->available_quantity - $quantity;

            $newStatus = $newAvailableQuantity === 0
                ? Listing::STATUS_DONE
                : Listing::STATUS_PARTIAL;

            $listing->update([
                'traded_quantity' => $newTradedQuantity,
                'available_quantity' => $newAvailableQuantity,
                'status' => $newStatus,
            ]);

            $contractNo = 'CTR' . date('YmdHis') . rand(1000, 9999);
            $deliveryDeadline = now()->addDays(15)->toDateString();

            Contract::create([
                'contract_no' => $contractNo,
                'trade_id' => $trade->id,
                'seller_id' => $listing->seller_id,
                'buyer_id' => $buyer->id,
                'energy_type' => $listing->energy_type,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_amount' => $totalAmount,
                'delivery_deadline' => $deliveryDeadline,
                'status' => Contract::STATUS_SIGNED,
                'signed_at' => now(),
            ]);

            $this->auditLogService->log(
                AuditLogService::BUSINESS_TRADE,
                AuditLogService::ACTION_MATCH,
                $trade->id,
                null,
                $trade->toArray(),
                '撮合成交'
            );

            return $trade;
        });
    }

    public function getMatchingListings(string $energyType, ?float $maxPrice = null)
    {
        $query = Listing::active()
            ->ofEnergyType($energyType)
            ->orderByPriceTime();

        if ($maxPrice !== null) {
            $query->where('unit_price', '<=', $maxPrice);
        }

        return $query->get();
    }

    public function getMarketDepth(string $energyType, int $levels = 10)
    {
        $cacheKey = "market_depth:{$energyType}";

        return Cache::remember($cacheKey, self::MATCHING_CACHE_TTL, function () use ($energyType, $levels) {
            $listings = Listing::active()
                ->ofEnergyType($energyType)
                ->selectRaw('unit_price, SUM(available_quantity) as total_quantity')
                ->groupBy('unit_price')
                ->orderBy('unit_price', 'asc')
                ->limit($levels)
                ->get();

            return [
                'energy_type' => $energyType,
                'bids' => $listings,
                'updated_at' => now()->toDateTimeString(),
            ];
        });
    }

    public function getListings(
        ?int $sellerId = null,
        ?string $energyType = null,
        ?string $status = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = Listing::with('seller');

        if ($sellerId) {
            $query->ofSeller($sellerId);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        if ($status) {
            $query->ofStatus($status);
        }

        return $query->orderBy('created_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function getTrades(
        ?int $userId = null,
        ?string $energyType = null,
        ?string $status = null,
        int $perPage = 20,
        int $page = 1
    ) {
        $query = Trade::with(['seller', 'buyer', 'listing']);

        if ($userId) {
            $query->ofUser($userId);
        }

        if ($energyType) {
            $query->ofEnergyType($energyType);
        }

        if ($status) {
            $query->ofStatus($status);
        }

        return $query->orderBy('matched_at', 'desc')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    public function getLatestPrice(string $energyType): ?float
    {
        $cacheKey = "latest_price:{$energyType}";

        return Cache::remember($cacheKey, 300, function () use ($energyType) {
            $latestTrade = Trade::ofEnergyType($energyType)
                ->orderBy('matched_at', 'desc')
                ->first();

            return $latestTrade?->unit_price;
        });
    }

    protected function clearMatchingCache(string $energyType): void
    {
        Cache::forget("market_depth:{$energyType}");
        Cache::forget("latest_price:{$energyType}");
    }
}
