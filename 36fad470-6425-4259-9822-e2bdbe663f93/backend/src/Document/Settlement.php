<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'settlements')]
#[MongoDB\Index(keys: ['month' => 1, 'performanceId' => 1], options: ['unique' => true])]
#[MongoDB\Index(keys: ['status' => 1])]
#[MongoDB\Index(keys: ['organizerId' => 1, 'createdAt' => -1])]
class Settlement
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_CONFIRMED_VENUE = 'confirmed_venue';
    public const STATUS_CONFIRMED_ORGANIZER = 'confirmed_organizer';
    public const STATUS_COMPLETED = 'completed';

    #[MongoDB\Id]
    #[Groups(['settlement:read', 'settlement:list'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $month;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $performanceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $performanceName;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $organizerId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $organizerName;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $totalRevenue = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $websiteRevenue = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $wechatRevenue = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $totalRefunds = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $serviceFee = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private float $netAmount = 0;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private string $status = self::STATUS_PENDING;

    #[MongoDB\EmbedMany(targetDocument: SettlementOrder::class)]
    #[Groups(['settlement:read'])]
    private Collection $orders;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['settlement:read', 'settlement:list'])]
    private \DateTimeInterface $createdAt;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['settlement:read'])]
    private ?\DateTimeInterface $confirmedVenueAt = null;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['settlement:read'])]
    private ?\DateTimeInterface $confirmedOrganizerAt = null;

    public function __construct()
    {
        $this->orders = new ArrayCollection();
        $this->createdAt = new \DateTime();
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getMonth(): string
    {
        return $this->month;
    }

    public function setMonth(string $month): self
    {
        $this->month = $month;
        return $this;
    }

    public function getPerformanceId(): string
    {
        return $this->performanceId;
    }

    public function setPerformanceId(string $performanceId): self
    {
        $this->performanceId = $performanceId;
        return $this;
    }

    public function getPerformanceName(): string
    {
        return $this->performanceName;
    }

    public function setPerformanceName(string $performanceName): self
    {
        $this->performanceName = $performanceName;
        return $this;
    }

    public function getOrganizerId(): string
    {
        return $this->organizerId;
    }

    public function setOrganizerId(string $organizerId): self
    {
        $this->organizerId = $organizerId;
        return $this;
    }

    public function getOrganizerName(): string
    {
        return $this->organizerName;
    }

    public function setOrganizerName(string $organizerName): self
    {
        $this->organizerName = $organizerName;
        return $this;
    }

    public function getTotalRevenue(): float
    {
        return $this->totalRevenue;
    }

    public function setTotalRevenue(float $totalRevenue): self
    {
        $this->totalRevenue = $totalRevenue;
        return $this;
    }

    public function getWebsiteRevenue(): float
    {
        return $this->websiteRevenue;
    }

    public function setWebsiteRevenue(float $websiteRevenue): self
    {
        $this->websiteRevenue = $websiteRevenue;
        return $this;
    }

    public function getWechatRevenue(): float
    {
        return $this->wechatRevenue;
    }

    public function setWechatRevenue(float $wechatRevenue): self
    {
        $this->wechatRevenue = $wechatRevenue;
        return $this;
    }

    public function getTotalRefunds(): float
    {
        return $this->totalRefunds;
    }

    public function setTotalRefunds(float $totalRefunds): self
    {
        $this->totalRefunds = $totalRefunds;
        return $this;
    }

    public function getServiceFee(): float
    {
        return $this->serviceFee;
    }

    public function setServiceFee(float $serviceFee): self
    {
        $this->serviceFee = $serviceFee;
        return $this;
    }

    public function getNetAmount(): float
    {
        return $this->netAmount;
    }

    public function setNetAmount(float $netAmount): self
    {
        $this->netAmount = $netAmount;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getOrders(): Collection
    {
        return $this->orders;
    }

    public function addOrder(SettlementOrder $order): self
    {
        if (!$this->orders->contains($order)) {
            $this->orders->add($order);
        }
        return $this;
    }

    public function removeOrder(SettlementOrder $order): self
    {
        $this->orders->removeElement($order);
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function getConfirmedVenueAt(): ?\DateTimeInterface
    {
        return $this->confirmedVenueAt;
    }

    public function setConfirmedVenueAt(?\DateTimeInterface $confirmedVenueAt): self
    {
        $this->confirmedVenueAt = $confirmedVenueAt;
        return $this;
    }

    public function getConfirmedOrganizerAt(): ?\DateTimeInterface
    {
        return $this->confirmedOrganizerAt;
    }

    public function setConfirmedOrganizerAt(?\DateTimeInterface $confirmedOrganizerAt): self
    {
        $this->confirmedOrganizerAt = $confirmedOrganizerAt;
        return $this;
    }
}
