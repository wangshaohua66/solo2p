<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\EmbeddedDocument]
class DeviceRequirement
{
    #[MongoDB\Id]
    #[Groups(['performance:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read'])]
    private string $deviceId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['performance:read'])]
    private string $deviceName;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['performance:read'])]
    private int $quantity;

    public function getId(): ?string
    {
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

    public function getDeviceName(): string
    {
        return $this->deviceName;
    }

    public function setDeviceName(string $deviceName): self
    {
        $this->deviceName = $deviceName;
        return $this;
    }

    public function getQuantity(): int
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): self
    {
        $this->quantity = $quantity;
        return $this;
    }
}
