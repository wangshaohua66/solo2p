<?php

namespace App\Entity;

use App\Repository\InspectionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: InspectionRepository::class)]
class Inspection
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read'])]
    private ?int $id = null;

    #[ORM\OneToOne(inversedBy: 'inspection', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false, unique: true)]
    private ?WorkOrder $workOrder = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?int $frequency = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $amplitude = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $rate = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $beatError = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?int $powerReserve = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $waterResistance = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $dialCondition = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $caseCondition = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $bandCondition = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 2, scale: 1, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $crownFunction = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 2, scale: 1, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $pushersFunction = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 2, scale: 1, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $dateFunction = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 2, scale: 1, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $chronographFunction = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $notes = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\PrePersist]
    public function setTimestamp(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function setUpdatedAt(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getWorkOrder(): ?WorkOrder
    {
        return $this->workOrder;
    }

    public function setWorkOrder(WorkOrder $workOrder): static
    {
        $this->workOrder = $workOrder;
        return $this;
    }

    public function getFrequency(): ?int
    {
        return $this->frequency;
    }

    public function setFrequency(?int $frequency): static
    {
        $this->frequency = $frequency;
        return $this;
    }

    public function getAmplitude(): ?string
    {
        return $this->amplitude;
    }

    public function setAmplitude(?string $amplitude): static
    {
        $this->amplitude = $amplitude;
        return $this;
    }

    public function getRate(): ?string
    {
        return $this->rate;
    }

    public function setRate(?string $rate): static
    {
        $this->rate = $rate;
        return $this;
    }

    public function getBeatError(): ?string
    {
        return $this->beatError;
    }

    public function setBeatError(?string $beatError): static
    {
        $this->beatError = $beatError;
        return $this;
    }

    public function getPowerReserve(): ?int
    {
        return $this->powerReserve;
    }

    public function setPowerReserve(?int $powerReserve): static
    {
        $this->powerReserve = $powerReserve;
        return $this;
    }

    public function getWaterResistance(): ?string
    {
        return $this->waterResistance;
    }

    public function setWaterResistance(?string $waterResistance): static
    {
        $this->waterResistance = $waterResistance;
        return $this;
    }

    public function getDialCondition(): ?string
    {
        return $this->dialCondition;
    }

    public function setDialCondition(?string $dialCondition): static
    {
        $this->dialCondition = $dialCondition;
        return $this;
    }

    public function getCaseCondition(): ?string
    {
        return $this->caseCondition;
    }

    public function setCaseCondition(?string $caseCondition): static
    {
        $this->caseCondition = $caseCondition;
        return $this;
    }

    public function getBandCondition(): ?string
    {
        return $this->bandCondition;
    }

    public function setBandCondition(?string $bandCondition): static
    {
        $this->bandCondition = $bandCondition;
        return $this;
    }

    public function getCrownFunction(): ?string
    {
        return $this->crownFunction;
    }

    public function setCrownFunction(?string $crownFunction): static
    {
        $this->crownFunction = $crownFunction;
        return $this;
    }

    public function getPushersFunction(): ?string
    {
        return $this->pushersFunction;
    }

    public function setPushersFunction(?string $pushersFunction): static
    {
        $this->pushersFunction = $pushersFunction;
        return $this;
    }

    public function getDateFunction(): ?string
    {
        return $this->dateFunction;
    }

    public function setDateFunction(?string $dateFunction): static
    {
        $this->dateFunction = $dateFunction;
        return $this;
    }

    public function getChronographFunction(): ?string
    {
        return $this->chronographFunction;
    }

    public function setChronographFunction(?string $chronographFunction): static
    {
        $this->chronographFunction = $chronographFunction;
        return $this;
    }

    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): static
    {
        $this->notes = $notes;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
