<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\EmbeddedDocument]
class SettlementOrder
{
    #[MongoDB\Id]
    #[Groups(['settlement:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read'])]
    private string $orderId;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read'])]
    private string $orderNo;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['settlement:read'])]
    private string $salesChannel;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['settlement:read'])]
    private float $amount;

    #[MongoDB\Field(type: 'boolean')]
    #[Groups(['settlement:read'])]
    private bool $isMatched = true;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getOrderId(): string
    {
        return $this->orderId;
    }

    public function setOrderId(string $orderId): self
    {
        $this->orderId = $orderId;
        return $this;
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

    public function getSalesChannel(): string
    {
        return $this->salesChannel;
    }

    public function setSalesChannel(string $salesChannel): self
    {
        $this->salesChannel = $salesChannel;
        return $this;
    }

    public function getAmount(): float
    {
        return $this->amount;
    }

    public function setAmount(float $amount): self
    {
        $this->amount = $amount;
        return $this;
    }

    public function isMatched(): bool
    {
        return $this->isMatched;
    }

    public function setIsMatched(bool $isMatched): self
    {
        $this->isMatched = $isMatched;
        return $this;
    }
}
