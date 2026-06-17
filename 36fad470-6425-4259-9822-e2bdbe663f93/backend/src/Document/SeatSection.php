<?php

namespace App\Document;

use Doctrine\ODM\MongoDB\Mapping\Annotations as MongoDB;
use Symfony\Component\Serializer\Annotation\Groups;

#[MongoDB\EmbeddedDocument]
class SeatSection
{
    public const TYPE_POOL = 'pool';
    public const TYPE_BALCONY = 'balcony';
    public const TYPE_BOX = 'box';
    public const TYPE_SIDE = 'side';

    public const NUMBERING_CONTINUOUS = 'continuous';
    public const NUMBERING_ROW_BASED = 'row_based';
    public const NUMBERING_CUSTOM = 'custom';

    #[MongoDB\Id]
    #[Groups(['venue:read'])]
    private ?string $id = null;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['venue:read', 'seat:read'])]
    private string $name;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['venue:read', 'seat:read'])]
    private string $type = self::TYPE_POOL;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['venue:read'])]
    private int $rows;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['venue:read'])]
    private int $columns;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['venue:read'])]
    private int $startRow = 1;

    #[MongoDB\Field(type: 'int')]
    #[Groups(['venue:read'])]
    private int $startColumn = 1;

    #[MongoDB\Field(type: 'string')]
    #[Groups(['venue:read'])]
    private string $numberingRule = self::NUMBERING_ROW_BASED;

    #[MongoDB\Field(type: 'float')]
    #[Groups(['venue:read', 'seat:read'])]
    private float $basePrice;

    #[MongoDB\Field(type: 'collection')]
    #[Groups(['venue:read'])]
    private array $disabledForTypes = [];

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
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

    public function getRows(): int
    {
        return $this->rows;
    }

    public function setRows(int $rows): self
    {
        $this->rows = $rows;
        return $this;
    }

    public function getColumns(): int
    {
        return $this->columns;
    }

    public function setColumns(int $columns): self
    {
        $this->columns = $columns;
        return $this;
    }

    public function getStartRow(): int
    {
        return $this->startRow;
    }

    public function setStartRow(int $startRow): self
    {
        $this->startRow = $startRow;
        return $this;
    }

    public function getStartColumn(): int
    {
        return $this->startColumn;
    }

    public function setStartColumn(int $startColumn): self
    {
        $this->startColumn = $startColumn;
        return $this;
    }

    public function getNumberingRule(): string
    {
        return $this->numberingRule;
    }

    public function setNumberingRule(string $numberingRule): self
    {
        $this->numberingRule = $numberingRule;
        return $this;
    }

    public function getBasePrice(): float
    {
        return $this->basePrice;
    }

    public function setBasePrice(float $basePrice): self
    {
        $this->basePrice = $basePrice;
        return $this;
    }

    public function getDisabledForTypes(): array
    {
        return $this->disabledForTypes;
    }

    public function setDisabledForTypes(array $disabledForTypes): self
    {
        $this->disabledForTypes = $disabledForTypes;
        return $this;
    }
}
