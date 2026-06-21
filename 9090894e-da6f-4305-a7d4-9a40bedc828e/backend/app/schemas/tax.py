from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.common import BaseSchema


class TaxCalcItem(BaseSchema):
    product_name: str
    hs_code: str
    quantity: int = 1
    unit_price: float = 0.0
    currency: str = "USD"
    exchange_rate: Optional[float] = 7.25


class TaxCalcResult(BaseSchema):
    hs_code: str
    product_name: str
    refund_rate: float
    tax_basis: float
    refund_amount: float
    policy_no: str
    effective_date: str


class TaxCalcRequest(BaseSchema):
    items: List[TaxCalcItem]
    policy_version: Optional[str] = None


class RefundRateResponse(BaseSchema):
    rate: float
    policy_no: str
    effective_date: str


class TaxPolicyVersion(BaseSchema):
    version: str
    effective_date: str
    description: str


class TaxTrendItem(BaseSchema):
    month: str
    rate: float
    amount: float
