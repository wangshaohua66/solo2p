<?php

namespace App\Entity;

use App\Repository\WorkOrderImageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;

#[ORM\Entity(repositoryClass: WorkOrderImageRepository::class)]
class WorkOrderImage
{
    public const TYPE_INTAKE = 'intake';
    public const TYPE_DURING = 'during';
    public const TYPE_AFTER = 'after';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'images', targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?WorkOrder $workOrder = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $fileName = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?string $originalFileName = null;

    #[ORM\Column(length: 32)]
    #[Groups(['workorder:read'])]
    private string $type = self::TYPE_INTAKE;

    #[ORM\Column(length: 500)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?string $url = null;

    #[ORM\Column(length: 200, nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?string $caption = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $filePath = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?int $fileSize = null;

    #[ORM\Column(length: 10, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $mimeType = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?int $width = null;

    #[ORM\Column(type: Types::INTEGER, nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?int $height = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read'])]
    private ?\DateTimeImmutable $uploadedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    private ?User $uploadedBy = null;

    #[ORM\PrePersist]
    public function setTimestamp(): void
    {
        $this->uploadedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getWorkOrder(): ?WorkOrder
    {
        return $this->workOrder;
    }

    public function setWorkOrder(?WorkOrder $workOrder): static
    {
        $this->workOrder = $workOrder;
        return $this;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getUrl(): ?string
    {
        return $this->url;
    }

    public function setUrl(string $url): static
    {
        $this->url = $url;
        return $this;
    }

    public function getCaption(): ?string
    {
        return $this->caption;
    }

    public function setCaption(?string $caption): static
    {
        $this->caption = $caption;
        return $this;
    }

    public function getFilePath(): ?string
    {
        return $this->filePath;
    }

    public function setFilePath(?string $filePath): static
    {
        $this->filePath = $filePath;
        return $this;
    }

    public function getFileSize(): ?int
    {
        return $this->fileSize;
    }

    public function setFileSize(?int $fileSize): static
    {
        $this->fileSize = $fileSize;
        return $this;
    }

    public function getMimeType(): ?string
    {
        return $this->mimeType;
    }

    public function setMimeType(?string $mimeType): static
    {
        $this->mimeType = $mimeType;
        return $this;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(?string $fileName): static
    {
        $this->fileName = $fileName;
        return $this;
    }

    public function getOriginalFileName(): ?string
    {
        return $this->originalFileName;
    }

    public function setOriginalFileName(?string $originalFileName): static
    {
        $this->originalFileName = $originalFileName;
        return $this;
    }

    public function getWidth(): ?int
    {
        return $this->width;
    }

    public function setWidth(?int $width): static
    {
        $this->width = $width;
        return $this;
    }

    public function getHeight(): ?int
    {
        return $this->height;
    }

    public function setHeight(?int $height): static
    {
        $this->height = $height;
        return $this;
    }

    public function getUploadedAt(): ?\DateTimeImmutable
    {
        return $this->uploadedAt;
    }

    public function getUploadedBy(): ?User
    {
        return $this->uploadedBy;
    }

    public function setUploadedBy(?User $uploadedBy): static
    {
        $this->uploadedBy = $uploadedBy;
        return $this;
    }
}
