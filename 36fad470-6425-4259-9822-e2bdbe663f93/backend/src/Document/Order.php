<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'orders')]
#[MongoDB\Index(keys: ['orderNo' => 1], options: ['unique' => true])]
#[MongoDB\Index(keys: ['userId' => 1, 'createdAt' => -1])]
#[MongoDB\Index(keys: ['performanceId' => 1, 'status' => 1])]
#[MongoDB\Index(keys: ['salesChannel' => 1, 'createdAt' => -1])]
class Order
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REFUNDED = 'refunded';
    public const STATUS_USED = 'used';

    public const PAYMENT_ALIPAY = 'alipay';
    public const PAYMENT_WECHAT = 'wechat';

    public const CHANNEL_WEBSITE = 'website';
    public const CHANNEL_WECHAT_MINIAPP = 'wechat_miniapp';

    public const TICKET_EARLY_BIRD = 'early_bird';
    public const TICKET_REGULAR = 'regular';
    public const TICKET_STUDENT = 'student';
    public const TICKET_GROUP = 'group';

    #[MongoDB\Id]
    #[Groups(['order:read', 'order:list'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $orderNo;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $performanceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $performanceName;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read'])]
    private string $userId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read'])]
    private string $userName;

    #[MongoDB\ReferenceMany(targetDocument: Seat::class, storeAs: 'id')]
    #[Groups(['order:read'])]
    private Collection $seats;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['order:read', 'order:list'])]
    private float $totalAmount;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['order:read'])]
    private float $discountAmount = 0;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['order:read', 'order:list'])]
    private float $payAmount;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $ticketType;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $status = self::STATUS_PENDING;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['order:read'])]
    private ?string $paymentChannel = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['order:read', 'order:list'])]
    private string $salesChannel;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['order:read'])]
    private ?\DateTimeInterface $paidAt = null;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['order:read'])]
    private ?\DateTimeInterface $cancelledAt = null;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['order:read', 'order:list'])]
    private \DateTimeInterface $createdAt;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['order:read'])]
    private ?string $qrCode = null;

    #[MongoDB\Field(type: 'float', nullable: true)]
    #[Groups(['order:read'])]
    private ?float $refundAmount = null;

    #[MongoDB\Field(type: 'float', nullable: true)]
    #[Groups(['order:read'])]
    private ?float $refundFee = null;

    #[MongoDB\Field(type: 'date', nullable: true)]
    #[Groups(['order:read', 'order:list'])]
    private ?\DateTimeInterface $usedAt = null;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['order:read'])]
    private ?string $verifiedBy = null;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['order:read'])]
    private ?string $verifiedByName = null;

    public function __construct()
    {
        $this->seats = new ArrayCollection();
        $this->createdAt = new \DateTime();
        $this->orderNo = 'TT' . date('YmdHis') . str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getOrderNo(): string
    {
        return $this->orderNo;
    }

    public function setOrderNo(string $orderNo): self
    {
        $this->orderNo = $orderNo;
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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function setUserName(string $userName): self
    {
        $this->userName = $userName;
        return $this;
    }

    public function getSeats(): Collection
    {
        return $this->seats;
    }

    public function addSeat(Seat $seat): self
    {
        if (!$this->seats->contains($seat)) {
            $this->seats->add($seat);
        }
        return $this;
    }

    public function removeSeat(Seat $seat): self
    {
        $this->seats->removeElement($seat);
        return $this;
    }

    public function getTotalAmount(): float
    {
        return $this->totalAmount;
    }

    public function setTotalAmount(float $totalAmount): self
    {
        $this->totalAmount = $totalAmount;
        return $this;
    }

    public function getDiscountAmount(): float
    {
        return $this->discountAmount;
    }

    public function setDiscountAmount(float $discountAmount): self
    {
        $this->discountAmount = $discountAmount;
        return $this;
    }

    public function getPayAmount(): float
    {
        return $this->payAmount;
    }

    public function setPayAmount(float $payAmount): self
    {
        $this->payAmount = $payAmount;
        return $this;
    }

    public function getTicketType(): string
    {
        return $this->ticketType;
    }

    public function setTicketType(string $ticketType): self
    {
        $this->ticketType = $ticketType;
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

    public function getPaymentChannel(): ?string
    {
        return $this->paymentChannel;
    }

    public function setPaymentChannel(?string $paymentChannel): self
    {
        $this->paymentChannel = $paymentChannel;
        return $this;
    }

    public function getSalesChannel(): string
    {
        return $this->salesChannel;
    }

    public function setSalesChannel(string $salesChannel): self
    {
        $this->salesChannel = $salesChannel;
        return $this;
    }

    public function getPaidAt(): ?\DateTimeInterface
    {
        return $this->paidAt;
    }

    public function setPaidAt(?\DateTimeInterface $paidAt): self
    {
        $this->paidAt = $paidAt;
        return $this;
    }

    public function getCancelledAt(): ?\DateTimeInterface
    {
        return $this->cancelledAt;
    }

    public function setCancelledAt(?\DateTimeInterface $cancelledAt): self
    {
        $this->cancelledAt = $cancelledAt;
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }

    public function getQrCode(): ?string
    {
        return $this->qrCode;
    }

    public function setQrCode(?string $qrCode): self
    {
        $this->qrCode = $qrCode;
        return $this;
    }

    public function getRefundAmount(): ?float
    {
        return $this->refundAmount;
    }

    public function setRefundAmount(?float $refundAmount): self
    {
        $this->refundAmount = $refundAmount;
        return $this;
    }

    public function getRefundFee(): ?float
    {
        return $this->refundFee;
    }

    public function setRefundFee(?float $refundFee): self
    {
        $this->refundFee = $refundFee;
        return $this;
    }

    public function getUsedAt(): ?\DateTimeInterface
    {
        return $this->usedAt;
    }

    public function setUsedAt(?\DateTimeInterface $usedAt): self
    {
        $this->usedAt = $usedAt;
        return $this;
    }

    public function getVerifiedBy(): ?string
    {
        return $this->verifiedBy;
    }

    public function setVerifiedBy(?string $verifiedBy): self
    {
        $this->verifiedBy = $verifiedBy;
        return $this;
    }

    public function getVerifiedByName(): ?string
    {
        return $this->verifiedByName;
    }

    public function setVerifiedByName(?string $verifiedByName): self
    {
        $this->verifiedByName = $verifiedByName;
        return $this;
    }
}
