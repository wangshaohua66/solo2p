<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'price_change_logs')]
#[MongoDB\Index(keys: ['performanceId' => 1, 'createdAt' => -1])]
#[MongoDB\Index(keys: ['operatorId' => 1])]
#[MongoDB\Index(keys: ['createdAt' => -1])]
class PriceChangeLog
{
    #[MongoDB\Id]
    #[Groups(['price_log:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['price_log:read'])]
    private string $performanceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['price_log:read'])]
    private string $performanceName;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['price_log:read'])]
    private ?string $sectionId = null;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['price_log:read'])]
    private ?string $sectionName = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['price_log:read'])]
    private string $ticketType;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['price_log:read'])]
    private float $oldPrice;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['price_log:read'])]
    private float $newPrice;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['price_log:read'])]
    private string $operatorId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['price_log:read'])]
    private string $operatorName;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['price_log:read'])]
    private ?string $reason = null;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['price_log:read'])]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
    }

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

    public function getPerformanceName(): string
    {
        return $this->performanceName;
    }

    public function setPerformanceName(string $performanceName): self
    {
        $this->performanceName = $performanceName;
        return $this;
    }

    public function getSectionId(): ?string
    {
        return $this->sectionId;
    }

    public function setSectionId(?string $sectionId): self
    {
        $this->sectionId = $sectionId;
        return $this;
    }

    public function getSectionName(): ?string
    {
        return $this->sectionName;
    }

    public function setSectionName(?string $sectionName): self
    {
        $this->sectionName = $sectionName;
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

    public function getOldPrice(): float
    {
        return $this->oldPrice;
    }

    public function setOldPrice(float $oldPrice): self
    {
        $this->oldPrice = $oldPrice;
        return $this;
    }

    public function getNewPrice(): float
    {
        return $this->newPrice;
    }

    public function setNewPrice(float $newPrice): self
    {
        $this->newPrice = $newPrice;
        return $this;
    }

    public function getOperatorId(): string
    {
        return $this->operatorId;
    }

    public function setOperatorId(string $operatorId): self
    {
        $this->operatorId = $operatorId;
        return $this;
    }

    public function getOperatorName(): string
    {
        return $this->operatorName;
    }

    public function setOperatorName(string $operatorName): self
    {
        $this->operatorName = $operatorName;
        return $this;
    }

    public function getReason(): ?string
    {
        return $this->reason;
    }

    public function setReason(?string $reason): self
    {
        $this->reason = $reason;
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }
}
