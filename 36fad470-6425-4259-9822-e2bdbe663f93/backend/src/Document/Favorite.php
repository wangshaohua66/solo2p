<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\Document(collection: 'favorites')]
#[MongoDB\Index(keys: ['userId' => 1, 'performanceId' => 1], unique: true)]
#[MongoDB\Index(keys: ['userId' => 1, 'createdAt' => -1])]
class Favorite
{
    #[MongoDB\Id]
    #[Groups(['favorite:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['favorite:read'])]
    private string $userId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['favorite:read'])]
    private string $performanceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['favorite:read'])]
    private string $performanceName;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['favorite:read'])]
    private ?string $performanceImage = null;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['favorite:read'])]
    private \DateTimeInterface $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
    }

    public function getId(): ?string
    {
        return $this->id;
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

    public function getPerformanceImage(): ?string
    {
        return $this->performanceImage;
    }

    public function setPerformanceImage(?string $performanceImage): self
    {
        $this->performanceImage = $performanceImage;
        return $this;
    }

    public function getCreatedAt(): \DateTimeInterface
    {
        return $this->createdAt;
    }
}
