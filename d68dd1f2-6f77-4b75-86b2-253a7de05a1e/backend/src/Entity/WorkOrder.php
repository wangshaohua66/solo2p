<?php

namespace App\Entity;

use App\Repository\WorkOrderRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: WorkOrderRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ORM\Index(name: 'idx_status', columns: ['status'])]
#[ORM\Index(name: 'idx_customer', columns: ['customer_id'])]
#[ORM\Index(name: 'idx_case_serial', columns: ['case_serial_number'])]
#[ORM\Index(name: 'idx_created_at', columns: ['created_at'])]
class WorkOrder
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING_QUOTE = 'pending_quote';
    public const STATUS_QUOTED = 'quoted';
    public const STATUS_IN_REPAIR = 'in_repair';
    public const STATUS_PENDING_QA = 'pending_qa';
    public const STATUS_READY_FOR_PICKUP = 'ready_for_pickup';
    public const STATUS_DELIVERED = 'delivered';
    public const STATUS_WARRANTY = 'warranty';
    public const STATUS_ARCHIVED = 'archived';

    public const PRIORITY_NORMAL = 'normal';
    public const PRIORITY_URGENT = 'urgent';
    public const PRIORITY_EXPRESS = 'express';

    public const STATUS_FLOW = [
        self::STATUS_DRAFT,
        self::STATUS_PENDING_QUOTE,
        self::STATUS_QUOTED,
        self::STATUS_IN_REPAIR,
        self::STATUS_PENDING_QA,
        self::STATUS_READY_FOR_PICKUP,
        self::STATUS_DELIVERED,
        self::STATUS_WARRANTY,
        self::STATUS_ARCHIVED,
    ];

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['workorder:read', 'workorder:list', 'customer:read', 'public:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 32, unique: true)]
    #[Assert\Length(max: 32)]
    #[Groups(['workorder:read', 'workorder:list', 'customer:read', 'public:read'])]
    private ?string $orderNumber = null;

    #[ORM\ManyToOne(inversedBy: 'workOrders')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Customer $customer = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 50)]
    #[Groups(['workorder:read', 'workorder:list', 'customer:read', 'public:read'])]
    private ?string $brand = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    #[Groups(['workorder:read', 'workorder:list', 'customer:read', 'public:read'])]
    private ?string $model = null;

    #[ORM\Column(length: 50)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 50)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?string $caseSerialNumber = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read'])]
    private ?string $movementSerialNumber = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?string $movementCode = null;

    #[ORM\ManyToOne(targetEntity: Movement::class)]
    #[ORM\JoinColumn(nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?Movement $movement = null;

    #[ORM\Column(length: 32)]
    #[Groups(['workorder:read', 'workorder:list', 'customer:read', 'public:read'])]
    private string $status = self::STATUS_DRAFT;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?\DateTimeImmutable $intakeDate = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?\DateTimeImmutable $estimatedDeliveryDate = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?\DateTimeImmutable $actualDeliveryDate = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Assert\NotBlank]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?string $problemDescription = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['workorder:read', 'public:read'])]
    private ?string $customerNotes = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $internalNotes = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?User $assignedTechnician = null;

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2, options: ['default' => 0])]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private string $laborPrice = '0.00';

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2, options: ['default' => 0])]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private string $partsPrice = '0.00';

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2, options: ['default' => 0])]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private string $totalPrice = '0.00';

    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2, options: ['default' => 0])]
    #[Groups(['workorder:read'])]
    private string $deposit = '0.00';

    #[ORM\Column(type: Types::INTEGER, options: ['default' => 12])]
    #[Groups(['workorder:read', 'public:read'])]
    private int $warrantyMonths = 12;

    #[ORM\Column(length: 32, options: ['default' => 'normal'])]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private string $priority = self::PRIORITY_NORMAL;

    #[ORM\Column(type: Types::BOOLEAN, options: ['default' => false])]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private bool $repeatVisit = false;

    #[ORM\ManyToOne(targetEntity: WorkOrder::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?WorkOrder $previousOrder = null;

    /**
     * @var Collection<int, WorkOrderImage>
     */
    #[ORM\OneToMany(mappedBy: 'workOrder', targetEntity: WorkOrderImage::class, cascade: ['persist', 'remove'])]
    #[Groups(['workorder:read', 'public:read'])]
    private Collection $images;

    #[ORM\OneToOne(mappedBy: 'workOrder', targetEntity: Inspection::class, cascade: ['persist', 'remove'])]
    #[Groups(['workorder:read', 'public:read'])]
    private ?Inspection $inspection = null;

    /**
     * @var Collection<int, PartUsage>
     */
    #[ORM\OneToMany(mappedBy: 'workOrder', targetEntity: PartUsage::class, cascade: ['persist', 'remove'])]
    #[Groups(['workorder:read', 'public:read'])]
    private Collection $partUsages;

    /**
     * @var Collection<int, WorkOrderLog>
     */
    #[ORM\OneToMany(mappedBy: 'workOrder', targetEntity: WorkOrderLog::class, cascade: ['persist', 'remove'])]
    #[ORM\OrderBy(['createdAt' => 'DESC'])]
    #[Groups(['workorder:read'])]
    private Collection $logs;

    /**
     * @var Collection<int, ServiceItem>
     */
    #[ORM\OneToMany(mappedBy: 'workOrder', targetEntity: ServiceItem::class, cascade: ['persist', 'remove'])]
    #[Groups(['workorder:read'])]
    private Collection $serviceItems;

    #[ORM\OneToOne(mappedBy: 'workOrder', targetEntity: Warranty::class, cascade: ['persist', 'remove'])]
    #[Groups(['workorder:read', 'public:read'])]
    private ?Warranty $warranty = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['workorder:read', 'workorder:list', 'public:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->images = new ArrayCollection();
        $this->partUsages = new ArrayCollection();
        $this->logs = new ArrayCollection();
        $this->serviceItems = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function setTimestampsOnCreate(): void
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
        if ($this->intakeDate === null) {
            $this->intakeDate = $now;
        }
        if ($this->orderNumber === null) {
            $this->orderNumber = 'WO' . $now->format('Ymd') .
                str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        }
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtOnUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOrderNumber(): ?string
    {
        return $this->orderNumber;
    }

    public function setOrderNumber(string $orderNumber): static
    {
        $this->orderNumber = $orderNumber;
        return $this;
    }

    public function getCustomer(): ?Customer
    {
        return $this->customer;
    }

    public function setCustomer(?Customer $customer): static
    {
        $this->customer = $customer;
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

    public function getModel(): ?string
    {
        return $this->model;
    }

    public function setModel(string $model): static
    {
        $this->model = $model;
        return $this;
    }

    public function getCaseSerialNumber(): ?string
    {
        return $this->caseSerialNumber;
    }

    public function setCaseSerialNumber(string $caseSerialNumber): static
    {
        $this->caseSerialNumber = $caseSerialNumber;
        return $this;
    }

    public function getMovementSerialNumber(): ?string
    {
        return $this->movementSerialNumber;
    }

    public function setMovementSerialNumber(?string $movementSerialNumber): static
    {
        $this->movementSerialNumber = $movementSerialNumber;
        return $this;
    }

    public function getMovementCode(): ?string
    {
        return $this->movementCode;
    }

    public function setMovementCode(?string $movementCode): static
    {
        $this->movementCode = $movementCode;
        return $this;
    }

    public function getMovement(): ?Movement
    {
        return $this->movement;
    }

    public function setMovement(?Movement $movement): static
    {
        $this->movement = $movement;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getIntakeDate(): ?\DateTimeImmutable
    {
        return $this->intakeDate;
    }

    public function setIntakeDate(\DateTimeImmutable $intakeDate): static
    {
        $this->intakeDate = $intakeDate;
        return $this;
    }

    public function getEstimatedDeliveryDate(): ?\DateTimeImmutable
    {
        return $this->estimatedDeliveryDate;
    }

    public function setEstimatedDeliveryDate(?\DateTimeImmutable $estimatedDeliveryDate): static
    {
        $this->estimatedDeliveryDate = $estimatedDeliveryDate;
        return $this;
    }

    public function getActualDeliveryDate(): ?\DateTimeImmutable
    {
        return $this->actualDeliveryDate;
    }

    public function setActualDeliveryDate(?\DateTimeImmutable $actualDeliveryDate): static
    {
        $this->actualDeliveryDate = $actualDeliveryDate;
        return $this;
    }

    public function getProblemDescription(): ?string
    {
        return $this->problemDescription;
    }

    public function setProblemDescription(string $problemDescription): static
    {
        $this->problemDescription = $problemDescription;
        return $this;
    }

    public function getCustomerNotes(): ?string
    {
        return $this->customerNotes;
    }

    public function setCustomerNotes(?string $customerNotes): static
    {
        $this->customerNotes = $customerNotes;
        return $this;
    }

    public function getInternalNotes(): ?string
    {
        return $this->internalNotes;
    }

    public function setInternalNotes(?string $internalNotes): static
    {
        $this->internalNotes = $internalNotes;
        return $this;
    }

    public function getAssignedTechnician(): ?User
    {
        return $this->assignedTechnician;
    }

    public function setAssignedTechnician(?User $assignedTechnician): static
    {
        $this->assignedTechnician = $assignedTechnician;
        return $this;
    }

    public function getLaborPrice(): string
    {
        return $this->laborPrice;
    }

    public function setLaborPrice(string $laborPrice): static
    {
        $this->laborPrice = $laborPrice;
        return $this;
    }

    public function getPartsPrice(): string
    {
        return $this->partsPrice;
    }

    public function setPartsPrice(string $partsPrice): static
    {
        $this->partsPrice = $partsPrice;
        return $this;
    }

    public function getTotalPrice(): string
    {
        return $this->totalPrice;
    }

    public function setTotalPrice(string $totalPrice): static
    {
        $this->totalPrice = $totalPrice;
        return $this;
    }

    public function getDeposit(): string
    {
        return $this->deposit;
    }

    public function setDeposit(string $deposit): static
    {
        $this->deposit = $deposit;
        return $this;
    }

    public function getWarrantyMonths(): int
    {
        return $this->warrantyMonths;
    }

    public function setWarrantyMonths(int $warrantyMonths): static
    {
        $this->warrantyMonths = $warrantyMonths;
        return $this;
    }

    public function getPriority(): string
    {
        return $this->priority;
    }

    public function setPriority(string $priority): static
    {
        $this->priority = $priority;
        return $this;
    }

    public function isRepeatVisit(): bool
    {
        return $this->repeatVisit;
    }

    public function setRepeatVisit(bool $repeatVisit): static
    {
        $this->repeatVisit = $repeatVisit;
        return $this;
    }

    public function getPreviousOrder(): ?WorkOrder
    {
        return $this->previousOrder;
    }

    public function setPreviousOrder(?WorkOrder $previousOrder): static
    {
        $this->previousOrder = $previousOrder;
        return $this;
    }

    /**
     * @return Collection<int, WorkOrderImage>
     */
    public function getImages(): Collection
    {
        return $this->images;
    }

    public function addImage(WorkOrderImage $image): static
    {
        if (!$this->images->contains($image)) {
            $this->images->add($image);
            $image->setWorkOrder($this);
        }
        return $this;
    }

    public function removeImage(WorkOrderImage $image): static
    {
        if ($this->images->removeElement($image)) {
            if ($image->getWorkOrder() === $this) {
                $image->setWorkOrder(null);
            }
        }
        return $this;
    }

    public function getInspection(): ?Inspection
    {
        return $this->inspection;
    }

    public function setInspection(?Inspection $inspection): static
    {
        if ($inspection !== null) {
            $inspection->setWorkOrder($this);
        }
        $this->inspection = $inspection;
        return $this;
    }

    /**
     * @return Collection<int, PartUsage>
     */
    public function getPartUsages(): Collection
    {
        return $this->partUsages;
    }

    public function addPartUsage(PartUsage $partUsage): static
    {
        if (!$this->partUsages->contains($partUsage)) {
            $this->partUsages->add($partUsage);
            $partUsage->setWorkOrder($this);
        }
        return $this;
    }

    public function removePartUsage(PartUsage $partUsage): static
    {
        if ($this->partUsages->removeElement($partUsage)) {
            if ($partUsage->getWorkOrder() === $this) {
                // handled by orphan removal if configured
            }
        }
        return $this;
    }

    /**
     * @return Collection<int, WorkOrderLog>
     */
    public function getLogs(): Collection
    {
        return $this->logs;
    }

    public function addLog(WorkOrderLog $log): static
    {
        if (!$this->logs->contains($log)) {
            $this->logs->add($log);
            $log->setWorkOrder($this);
        }
        return $this;
    }

    /**
     * @return Collection<int, ServiceItem>
     */
    public function getServiceItems(): Collection
    {
        return $this->serviceItems;
    }

    public function addServiceItem(ServiceItem $item): static
    {
        if (!$this->serviceItems->contains($item)) {
            $this->serviceItems->add($item);
            $item->setWorkOrder($this);
        }
        return $this;
    }

    public function getWarranty(): ?Warranty
    {
        return $this->warranty;
    }

    public function setWarranty(?Warranty $warranty): static
    {
        if ($warranty !== null) {
            $warranty->setWorkOrder($this);
        }
        $this->warranty = $warranty;
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

    /**
     * @Groups({"workorder:read"})
     */
    public function getAssignedTechnicianName(): ?string
    {
        return $this->assignedTechnician?->getRealName();
    }

    public function addLogEntry(string $action, string $detail = null, User $operator = null): void
    {
        $log = new WorkOrderLog();
        $log->setAction($action);
        $log->setDetail($detail);
        $log->setOperator($operator);
        $this->addLog($log);
    }
}
