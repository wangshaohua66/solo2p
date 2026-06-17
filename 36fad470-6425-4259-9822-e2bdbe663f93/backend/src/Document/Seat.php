<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'seats')]
#[MongoDB\Index(keys: ['performanceId' => 1, 'status' => 1])]
#[MongoDB\Index(keys: ['performanceId' => 1, 'sectionId' => 1, 'row' => 1, 'column' => 1])]
#[MongoDB\Index(keys: ['lockedAt' => 1], options: ['expireAfterSeconds' => 900])]
class Seat
{
    public const STATUS_AVAILABLE = 'available';
    public const STATUS_SOLD = 'sold';
    public const STATUS_LOCKED = 'locked';
    public const STATUS_MAINTENANCE = 'maintenance';
    public const STATUS_RESERVED = 'reserved';

    public const TICKET_EARLY_BIRD = 'early_bird';
    public const TICKET_REGULAR = 'regular';
    public const TICKET_STUDENT = 'student';
    public const TICKET_GROUP = 'group';

    #[MongoDB\Id]
    #[Groups(['seat:read', 'order:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['seat:read'])]
    private string $performanceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['seat:read'])]
    private string $sectionId;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['seat:read', 'order:read'])]
    private int $row;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['seat:read', 'order:read'])]
    private int $column;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['seat:read', 'order:read'])]
    private string $seatNumber;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['seat:read', 'order:read'])]
    private string $status = self::STATUS_AVAILABLE;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['seat:read', 'order:read'])]
    private float $price;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['seat:read', 'order:read'])]
    private ?string $ticketType = null;

    #[MongoDB\Field(type: 'date', nullable: true)]
    private ?\DateTimeInterface $lockedAt = null;

    #[MongoDB\Field(type: 'string', nullable: true)]
    private ?string $lockedBy = null;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['seat:read'])]
    private ?string $orderId = null;

    public function getId(): ?string
    {
        return $this->id;
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

    public function getSectionId(): string
    {
        return $this->sectionId;
    }

    public function setSectionId(string $sectionId): self
    {
        $this->sectionId = $sectionId;
        return $this;
    }

    public function getRow(): int
    {
        return $this->row;
    }

    public function setRow(int $row): self
    {
        $this->row = $row;
        return $this;
    }

    public function getColumn(): int
    {
        return $this->column;
    }

    public function setColumn(int $column): self
    {
        $this->column = $column;
        return $this;
    }

    public function getSeatNumber(): string
    {
        return $this->seatNumber;
    }

    public function setSeatNumber(string $seatNumber): self
    {
        $this->seatNumber = $seatNumber;
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

    public function getPrice(): float
    {
        return $this->price;
    }

    public function setPrice(float $price): self
    {
        $this->price = $price;
        return $this;
    }

    public function getTicketType(): ?string
    {
        return $this->ticketType;
    }

    public function setTicketType(?string $ticketType): self
    {
        $this->ticketType = $ticketType;
        return $this;
    }

    public function getLockedAt(): ?\DateTimeInterface
    {
        return $this->lockedAt;
    }

    public function setLockedAt(?\DateTimeInterface $lockedAt): self
    {
        $this->lockedAt = $lockedAt;
        return $this;
    }

    public function getLockedBy(): ?string
    {
        return $this->lockedBy;
    }

    public function setLockedBy(?string $lockedBy): self
    {
        $this->lockedBy = $lockedBy;
        return $this;
    }

    public function getOrderId(): ?string
    {
        return $this->orderId;
    }

    public function setOrderId(?string $orderId): self
    {
        $this->orderId = $orderId;
        return $this;
    }
}
