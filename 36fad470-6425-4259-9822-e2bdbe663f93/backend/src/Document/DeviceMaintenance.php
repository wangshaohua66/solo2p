<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\EmbeddedDocument]
class DeviceMaintenance
{
    public const TYPE_ROUTINE = 'routine';
    public const TYPE_REPAIR = 'repair';
    public const TYPE_INSPECTION = 'inspection';

    #[MongoDB\Field(type: 'string')]
    #[Groups(['device:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    private string $deviceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['device:read'])]
    private string $type;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['device:read'])]
    private \DateTimeInterface $startTime;

    #[MongoDB\Field(type: 'date')]
    #[Groups(['device:read'])]
    private \DateTimeInterface $endTime;

    #[MongoDB\Field(type: 'string', nullable: true)]
    #[Groups(['device:read'])]
    private ?string $notes = null;

    public function __construct()
    {
        $this->id = uniqid('mt_');
    }

    public function getId(): ?string
    {
        if ($this->id === null) {
            $this->id = uniqid('mt_');
        }
        return $this->id;
    }

    public function getDeviceId(): string
    {
        return $this->deviceId;
    }

    public function setDeviceId(string $deviceId): self
    {
        $this->deviceId = $deviceId;
        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getStartTime(): \DateTimeInterface
    {
        return $this->startTime;
    }

    public function setStartTime(\DateTimeInterface $startTime): self
    {
        $this->startTime = $startTime;
        return $this;
    }

    public function getEndTime(): \DateTimeInterface
    {
        return $this->endTime;
    }

    public function setEndTime(\DateTimeInterface $endTime): self
    {
        $this->endTime = $endTime;
        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): self
    {
        $this->notes = $notes;
        return $this;
    }
}
