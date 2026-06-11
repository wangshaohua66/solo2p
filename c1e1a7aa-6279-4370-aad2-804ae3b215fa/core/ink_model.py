from datetime import datetime, date
from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator


class InkType(str, Enum):
    DYE = "dye"
    PIGMENT = "pigment"
    IRON_GALL = "iron_gall"
    CARBON = "carbon"


class CIELAB(BaseModel):
    l: float = Field(ge=0, le=100, description="Lightness 0-100")
    a: float = Field(ge=-128, le=127, description="a* axis green-red")
    b: float = Field(ge=-128, le=127, description="b* axis blue-yellow")

    @field_validator("l")
    @classmethod
    def validate_l(cls, v: float) -> float:
        return max(0.0, min(100.0, round(v, 2)))

    @field_validator("a", "b")
    @classmethod
    def validate_ab(cls, v: float) -> float:
        return max(-128.0, min(127.0, round(v, 2)))

    def to_tuple(self) -> tuple[float, float, float]:
        return (self.l, self.a, self.b)

    def to_dict(self) -> Dict[str, float]:
        return {"l": self.l, "a": self.a, "b": self.b}


class RGB(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)

    def to_tuple(self) -> tuple[int, int, int]:
        return (self.r, self.g, self.b)

    def to_hex(self) -> str:
        return f"#{self.r:02x}{self.g:02x}{self.b:02x}"


class InkBase(BaseModel):
    brand: str = Field(min_length=1, max_length=100)
    line: Optional[str] = Field(None, max_length=100)
    color_name: str = Field(min_length=1, max_length=100)
    volume_ml: float = Field(gt=0, le=10000)
    price: Optional[float] = Field(None, gt=0)
    cielab: CIELAB
    ink_type: InkType = Field(default=InkType.DYE)
    tags: List[str] = Field(default_factory=list)
    purchase_date: Optional[date] = None
    expiration_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("tags", mode="before")
    @classmethod
    def split_tags(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v

    @model_validator(mode="after")
    def auto_tag_from_type(self) -> "InkBase":
        type_tag = self.ink_type.value
        if type_tag not in self.tags:
            self.tags.append(type_tag)
        return self


class InkCreate(InkBase):
    pass


class Ink(InkBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    def full_name(self) -> str:
        if self.line:
            return f"{self.brand} {self.line} - {self.color_name}"
        return f"{self.brand} - {self.color_name}"


class RecipeComponent(BaseModel):
    ink_id: int
    ink_name: Optional[str] = None
    volume_ratio: float = Field(gt=0, le=1)
    volume_ml: Optional[float] = None


class RecipeBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    target_cielab: CIELAB
    delta_e: Optional[float] = None
    notes: Optional[str] = None


class RecipeCreate(RecipeBase):
    components: List[RecipeComponent]

    @field_validator("components")
    @classmethod
    def validate_ratio_sum(cls, v: List[RecipeComponent]) -> List[RecipeComponent]:
        total = sum(c.volume_ratio for c in v)
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Volume ratios must sum to 1.0, got {total:.3f}")
        return v


class Recipe(RecipeBase):
    id: int
    components: List[RecipeComponent]
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    ink_id: int
    bottle_count: int = Field(ge=0, default=1)
    current_ml: float = Field(ge=0)
    location: Optional[str] = None
    batch_number: Optional[str] = None


class InventoryCreate(InventoryBase):
    pass


class Inventory(InventoryBase):
    id: int
    ink: Optional[Ink] = None

    class Config:
        from_attributes = True


class JournalEntryBase(BaseModel):
    date: date
    pen: str = Field(min_length=1, max_length=100)
    nib: Optional[str] = Field(None, max_length=50)
    ink_id: int
    paper: str = Field(min_length=1, max_length=100)
    humidity: Optional[int] = Field(None, ge=0, le=100)
    rating: int = Field(ge=1, le=5)
    notes: Optional[str] = None


class JournalEntryCreate(JournalEntryBase):
    pass


class JournalEntry(JournalEntryBase):
    id: int
    ink: Optional[Ink] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MixingPrediction(BaseModel):
    recipe_id: Optional[int] = None
    result_cielab: CIELAB
    paper_white: CIELAB = CIELAB(l=95.0, a=0.0, b=0.0)
    color_shift_notes: Optional[str] = None
    components: List[RecipeComponent] = Field(default_factory=list)


class MixRecommendation(BaseModel):
    target_cielab: CIELAB
    recommended_components: List[RecipeComponent]
    predicted_cielab: CIELAB
    delta_e: float
    alternative_mixes: Optional[List["MixRecommendation"]] = None


class StockAlert(BaseModel):
    ink_id: int
    ink_name: str
    alert_type: str
    message: str
    severity: str
