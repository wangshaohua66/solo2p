<?php

namespace App\Entity;

use App\Repository\MovementRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: MovementRepository::class)]
#[ORM\Index(name: 'idx_brand', columns: ['brand'])]
#[ORM\Index(name: 'idx_code', columns: ['code'])]
class Movement
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    #[Groups(['movement:read', 'movement:list', 'workorder:read'])]
    private ?string $code = null;

    #[ORM\Column(length: 50)]
    #[Groups(['movement:read', 'movement:list', 'workorder:read'])]
    private ?string $brand = null;

    #[ORM\Column(length: 100)]
    #[Groups(['movement:read', 'movement:list'])]
    private ?string $caliber = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?int $frequency = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?int $jewelCount = null;

    #[ORM\Column(type: Types::INTEGER)]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?int $powerReserveHours = null;

    #[ORM\Column(length: 20)]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?string $standardAmplitude = null;

    #[ORM\Column(length: 20)]
    #[Groups(['movement:read', 'workorder:read'])]
    private ?string $standardRate = null;

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['movement:read'])]
    private array $serviceSteps = [];

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['movement:read', 'movement:list'])]
    private array $commonFailures = [];

    #[ORM\Column(type: Types::DECIMAL, precision: 6, scale: 2)]
    #[Groups(['movement:read'])]
    private string $standardLaborHours = '0.00';

    #[ORM\Column(type: Types::JSON)]
    #[Groups(['movement:read'])]
    private array $recommendedParts = [];

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['movement:read'])]
    private ?string $description = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = $code;
        return $this;
    }

    public function getBrand(): ?string
    {
        return $this->brand;
    }

    public function setBrand(string $brand): static
    {
        $this->brand = $brand;
        return $this;
    }

    public function getCaliber(): ?string
    {
        return $this->caliber;
    }

    public function setCaliber(string $caliber): static
    {
        $this->caliber = $caliber;
        return $this;
    }

    public function getFrequency(): ?int
    {
        return $this->frequency;
    }

    public function setFrequency(int $frequency): static
    {
        $this->frequency = $frequency;
        return $this;
    }

    public function getJewelCount(): ?int
    {
        return $this->jewelCount;
    }

    public function setJewelCount(int $jewelCount): static
    {
        $this->jewelCount = $jewelCount;
        return $this;
    }

    public function getPowerReserveHours(): ?int
    {
        return $this->powerReserveHours;
    }

    public function setPowerReserveHours(int $powerReserveHours): static
    {
        $this->powerReserveHours = $powerReserveHours;
        return $this;
    }

    public function getStandardAmplitude(): ?string
    {
        return $this->standardAmplitude;
    }

    public function setStandardAmplitude(string $standardAmplitude): static
    {
        $this->standardAmplitude = $standardAmplitude;
        return $this;
    }

    public function getStandardRate(): ?string
    {
        return $this->standardRate;
    }

    public function setStandardRate(string $standardRate): static
    {
        $this->standardRate = $standardRate;
        return $this;
    }

    public function getServiceSteps(): array
    {
        return $this->serviceSteps;
    }

    public function setServiceSteps(array $serviceSteps): static
    {
        $this->serviceSteps = $serviceSteps;
        return $this;
    }

    public function getCommonFailures(): array
    {
        return $this->commonFailures;
    }

    public function setCommonFailures(array $commonFailures): static
    {
        $this->commonFailures = $commonFailures;
        return $this;
    }

    public function getStandardLaborHours(): string
    {
        return $this->standardLaborHours;
    }

    public function setStandardLaborHours(string $standardLaborHours): static
    {
        $this->standardLaborHours = $standardLaborHours;
        return $this;
    }

    public function getRecommendedParts(): array
    {
        return $this->recommendedParts;
    }

    public function setRecommendedParts(array $recommendedParts): static
    {
        $this->recommendedParts = $recommendedParts;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }
}
