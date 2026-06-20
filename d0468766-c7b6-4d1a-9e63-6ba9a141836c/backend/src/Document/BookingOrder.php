<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Doctrine\ODM\MongoDB\Types\Type;
use DateTimeImmutable;

#[MongoDB\Document(collection: 'booking_orders')]
#[MongoDB\Index(keys: ['scheduleId' => 'asc', 'status' => 'asc'])]
class BookingOrder
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PAID = 'paid';
    public const STATUS_USED = 'used';
    public const STATUS_REFUNDED = 'refunded';
    public const STATUS_CANCELLED = 'cancelled';

    #[MongoDB\Id(strategy: 'NONE', type: Type::STRING)]
    private ?string $id = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $orderNo;

    #[MongoDB\Field(type: Type::STRING)]
    private string $scheduleId;

    #[MongoDB\Field(type: Type::STRING)]
    private string $movieName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $cinemaName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $hallName;

    #[MongoDB\Field(type: Type::STRING)]
    private string $date;

    #[MongoDB\Field(type: Type::STRING)]
    private string $startTime;

    #[MongoDB\Field(type: Type::STRING)]
    private string $endTime;

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $seats = [];

    #[MongoDB\Field(type: Type::INT)]
    private int $ticketCount;

    #[MongoDB\Field(type: Type::INT)]
    private int $totalAmount;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $memberId = null;

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $memberName = null;

    #[MongoDB\Field(type: Type::STRING)]
    private string $contactPhone = '';

    #[MongoDB\Field(type: Type::STRING)]
    private string $status = self::STATUS_PENDING;

    #[MongoDB\Field(type: Type::STRING)]
    private string $payMethod = '';

    #[MongoDB\Field(type: Type::STRING, nullable: true)]
    private ?string $qrCode = null;

    #[MongoDB\Field(type: Type::COLLECTION)]
    private array $concessions = [];

    #[MongoDB\Field(type: Type::INT)]
    private int $pointsEarned = 0;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE)]
    private DateTimeImmutable $createdAt;

    #[MongoDB\Field(type: Type::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $paidAt = null;

    public function __construct()
    {
        $this->createdAt = new DateTimeImmutable();
    }

    public function getId(): ?string { return $this->id; }
    public function setId(string $id): self { $this->id = $id; return $this; }
    public function getOrderNo(): string { return $this->orderNo; }
    public function setOrderNo(string $orderNo): self { $this->orderNo = $orderNo; return $this; }
    public function getScheduleId(): string { return $this->scheduleId; }
    public function setScheduleId(string $scheduleId): self { $this->scheduleId = $scheduleId; return $this; }
    public function getMovieName(): string { return $this->movieName; }
    public function setMovieName(string $movieName): self { $this->movieName = $movieName; return $this; }
    public function getCinemaName(): string { return $this->cinemaName; }
    public function getHallName(): string { return $this->hallName; }
    public function setHallName(string $hallName): self { $this->hallName = $hallName; return $this; }
    public function getDate(): string { return $this->date; }
    public function setDate(string $date): self { $this->date = $date; return $this; }
    public function getStartTime(): string { return $this->startTime; }
    public function setStartTime(string $startTime): self { $this->startTime = $startTime; return $this; }
    public function getEndTime(): string { return $this->endTime; }
    public function setEndTime(string $endTime): self { $this->endTime = $endTime; return $this; }
    public function getSeats(): array { return $this->seats; }
    public function setSeats(array $seats): self { $this->seats = $seats; return $this; }
    public function getTicketCount(): int { return $this->ticketCount; }
    public function setTicketCount(int $ticketCount): self { $this->ticketCount = $ticketCount; return $this; }
    public function getTotalAmount(): int { return $this->totalAmount; }
    public function setTotalAmount(int $totalAmount): self { $this->totalAmount = $totalAmount; return $this; }
    public function getMemberId(): ?string { return $this->memberId; }
    public function setMemberId(?string $memberId): self { $this->memberId = $memberId; return $this; }
    public function getStatus(): string { return $this->status; }
    public function setStatus(string $status): self { $this->status = $status; return $this; }
    public function getContactPhone(): string { return $this->contactPhone; }
    public function setContactPhone(string $contactPhone): self { $this->contactPhone = $contactPhone; return $this; }
    public function getPaidAt(): ?DateTimeImmutable { return $this->paidAt; }
    public function setPaidAt(?DateTimeImmutable $paidAt): self { $this->paidAt = $paidAt; return $this; }
    public function setCinemaName(string $cinemaName): self { $this->cinemaName = $cinemaName; return $this; }
    public function getQrCode(): ?string { return $this->qrCode; }
    public function setQrCode(?string $qrCode): self { $this->qrCode = $qrCode; return $this; }
    public function getPayMethod(): string { return $this->payMethod; }
    public function setPayMethod(string $payMethod): self { $this->payMethod = $payMethod; return $this; }
    public function getConcessions(): array { return $this->concessions; }
    public function setConcessions(array $concessions): self { $this->concessions = $concessions; return $this; }
    public function getPointsEarned(): int { return $this->pointsEarned; }
    public function setPointsEarned(int $pointsEarned): self { $this->pointsEarned = $pointsEarned; return $this; }
    public function getMemberName(): ?string { return $this->memberName; }
    public function setMemberName(?string $memberName): self { $this->memberName = $memberName; return $this; }
}
