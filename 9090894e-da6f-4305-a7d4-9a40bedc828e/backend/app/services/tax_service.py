import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session

from app.models.tax import TaxRate, TaxPolicy, TaxCalcRecord
from app.schemas.tax import (
    TaxCalcItem, TaxCalcResult, TaxCalcRequest, TaxPolicyVersion, RefundRateResponse, TaxTrendItem
)


DEFAULT_RATES = {
    "85171210": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "85176290": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "85258013": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "85044099": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "61091000": {"rate": 0.13, "policy": "财税〔2024〕3号"},
    "94052000": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "95030031": {"rate": 0.15, "policy": "财税〔2024〕2号"},
    "33041000": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "85287222": {"rate": 0.13, "policy": "财税〔2024〕1号"},
    "64029929": {"rate": 0.13, "policy": "财税〔2024〕1号"},
}

CURRENCY_RATES = {
    "USD": 7.25,
    "EUR": 7.85,
    "CNY": 1.0,
    "GBP": 9.20,
    "JPY": 0.048,
}

POLICY_VERSIONS = [
    {"version": "2024V1", "effective_date": "2024-01-01", "description": "2024年第一批退税率调整，玩具类15%、纺织品13%"},
    {"version": "2023V3", "effective_date": "2023-09-01", "description": "2023年第三批退税率调整"},
    {"version": "2023V1", "effective_date": "2023-01-01", "description": "2023年退税率基础版本"},
]


class TaxService:
    def __init__(self, db: Session):
        self.db = db

    def _get_rate(self, hs_code: str, policy_version: Optional[str] = None) -> Tuple[float, str]:
        db_rate = self.db.query(TaxRate).filter(TaxRate.hs_code == hs_code).first()
        if db_rate:
            return db_rate.refund_rate, db_rate.policy_no or "财税〔2024〕1号"
        rate_info = DEFAULT_RATES.get(hs_code, {"rate": 0.13, "policy": "财税〔2024〕1号"})
        return rate_info["rate"], rate_info["policy"]

    def get_refund_rate(self, hs_code: str) -> RefundRateResponse:
        rate, policy = self._get_rate(hs_code)
        return RefundRateResponse(
            rate=rate,
            policy_no=policy,
            effective_date="2024-01-01"
        )

    def calculate(self, request: TaxCalcRequest, user_id: str) -> List[TaxCalcResult]:
        results: List[TaxCalcResult] = []
        for item in request.items:
            rate, policy = self._get_rate(item.hs_code, request.policy_version)
            fx = item.exchange_rate or CURRENCY_RATES.get(item.currency, 7.25)
            foreign_amount = item.quantity * item.unit_price
            tax_basis = round(foreign_amount * fx, 2)
            refund_amount = round(tax_basis * rate, 2)
            results.append(TaxCalcResult(
                hs_code=item.hs_code,
                product_name=item.product_name,
                refund_rate=rate,
                tax_basis=tax_basis,
                refund_amount=refund_amount,
                policy_no=policy,
                effective_date="2024-01-01"
            ))

        record = TaxCalcRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            policy_version=request.policy_version,
            items=[i.model_dump() for i in request.items],
            results=[r.model_dump() for r in results],
            total_tax_basis=sum(r.tax_basis for r in results),
            total_refund_amount=sum(r.refund_amount for r in results)
        )
        self.db.add(record)
        self.db.commit()

        return results

    def get_policy_versions(self) -> List[TaxPolicyVersion]:
        db_policies = self.db.query(TaxPolicy).filter(TaxPolicy.is_active == True).all()
        if db_policies:
            return [
                TaxPolicyVersion(
                    version=p.version,
                    effective_date=p.effective_date.strftime("%Y-%m-%d"),
                    description=p.description or ""
                )
                for p in db_policies
            ]
        return [TaxPolicyVersion(**p) for p in POLICY_VERSIONS]

    def compare_policies(self, hs_code: str, version1: str, version2: str) -> Dict:
        rates = {
            "2024V1": {"85171210": 0.13, "61091000": 0.13, "95030031": 0.15, "85176290": 0.13},
            "2023V3": {"85171210": 0.13, "61091000": 0.12, "95030031": 0.13, "85176290": 0.13},
            "2023V1": {"85171210": 0.13, "61091000": 0.11, "95030031": 0.13, "85176290": 0.13},
        }
        r1 = rates.get(version1, {}).get(hs_code, 0.13)
        r2 = rates.get(version2, {}).get(hs_code, 0.13)
        return {
            "hs_code": hs_code,
            "version1": version1,
            "rate1": r1,
            "version2": version2,
            "rate2": r2,
            "difference": round((r1 - r2) * 100, 2)
        }

    def get_refund_trend(self, hs_code: str, months: int = 12) -> List[TaxTrendItem]:
        rate_map = {
            "85171210": [0.13] * 12,
            "61091000": [0.11, 0.11, 0.12, 0.12, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.13],
            "95030031": [0.13, 0.13, 0.13, 0.13, 0.14, 0.14, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
        }
        rates = rate_map.get(hs_code, [0.13] * 12)
        now = datetime.now()
        items = []
        for i in range(months - 1, -1, -1):
            m = (now.month - i) % 12 or 12
            y = now.year + ((now.month - i - 1) // 12)
            items.append(TaxTrendItem(
                month=f"{y}-{m:02d}",
                rate=rates[12 - i - 1] if 12 - i - 1 < len(rates) else 0.13,
                amount=10000 * (0.8 + 0.4 * (12 - i) / 12)
            ))
        return items
