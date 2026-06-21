from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.tax import (
    TaxCalcRequest, TaxCalcResult, RefundRateResponse,
    TaxPolicyVersion, TaxTrendItem
)
from app.schemas.common import ApiResponse
from app.services.tax_service import TaxService

router = APIRouter()


@router.post("/calculate", response_model=ApiResponse[List[TaxCalcResult]])
def calculate_tax(request: TaxCalcRequest, db: Session = Depends(get_db)):
    service = TaxService(db)
    results = service.calculate(request, user_id="mock_user_1")
    return ApiResponse.ok(results)


@router.get("/refund-rate/{hs_code}", response_model=ApiResponse[RefundRateResponse])
def get_refund_rate(hs_code: str, db: Session = Depends(get_db)):
    service = TaxService(db)
    result = service.get_refund_rate(hs_code)
    return ApiResponse.ok(result)


@router.get("/policies", response_model=ApiResponse[List[TaxPolicyVersion]])
def get_policy_versions(db: Session = Depends(get_db)):
    service = TaxService(db)
    items = service.get_policy_versions()
    return ApiResponse.ok(items)


@router.get("/compare/{hs_code}", response_model=ApiResponse)
def compare_policies(
    hs_code: str,
    version1: str = Query(...),
    version2: str = Query(...),
    db: Session = Depends(get_db)
):
    service = TaxService(db)
    result = service.compare_policies(hs_code, version1, version2)
    return ApiResponse.ok(result)


@router.get("/trend/{hs_code}", response_model=ApiResponse[List[TaxTrendItem]])
def get_trend(
    hs_code: str,
    months: int = Query(12, ge=1, le=24),
    db: Session = Depends(get_db)
):
    service = TaxService(db)
    items = service.get_refund_trend(hs_code, months)
    return ApiResponse.ok(items)
