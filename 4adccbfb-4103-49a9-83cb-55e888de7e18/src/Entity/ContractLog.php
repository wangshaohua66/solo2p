<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'contract_log')]
#[ORM\HasLifecycleCallbacks]
class ContractLog
{
    public const ACTION_SUBMIT = 'submit';
    public const ACTION_APPROVE = 'approve';
    public const ACTION_REJECT = 'reject';
    public const ACTION_SIGN = 'sign';
    public const ACTION_PAY = 'pay';

    public const ACTION_LABELS = [
        self::ACTION_SUBMIT => '提交合同',
        self::ACTION_APPROVE => '审批通过',
        self::ACTION_REJECT => '审批驳回',
        self::ACTION_SIGN => '电子签章',
        self::ACTION_PAY => '到款入账',
    ];

    public function getActionLabel(): string
    {
        return self::ACTION_LABELS[$this->action] ?? $this->action;
    }

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'logs')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Contract $contract = null;

    #[ORM\Column(length: 30)]
    private ?string $step = null;

    #[ORM\Column(length: 60, nullable: true)]
    private ?string $approver = null;

    #[ORM\Column(length: 20)]
    private ?string $action = null;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $comment = null;

    #[ORM\Column]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\PrePersist]
    public function touchCreatedAt(): void
    {
        $this->createdAt ??= new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getContract(): ?Contract
    {
        return $this->contract;
    }

    public function setContract(?Contract $contract): static
    {
        $this->contract = $contract;

        return $this;
    }

    public function getStep(): ?string
    {
        return $this->step;
    }

    public function setStep(string $step): static
    {
        $this->step = $step;

        return $this;
    }

    public function getApprover(): ?string
    {
        return $this->approver;
    }

    public function setApprover(?string $approver): static
    {
        $this->approver = $approver;

        return $this;
    }

    public function getAction(): ?string
    {
        return $this->action;
    }

    public function setAction(string $action): static
    {
        $this->action = $action;

        return $this;
    }

    public function getComment(): ?string
    {
        return $this->comment;
    }

    public function setComment(?string $comment): static
    {
        $this->comment = $comment;

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }
}
