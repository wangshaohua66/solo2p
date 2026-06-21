import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.user import User, UserRole, OperationLog
from app.models.declaration import Declaration, DeclarationStatus, DeclarationItem
from app.models.customs import CustomsException, ExceptionStatus
from app.models.tax import TaxCalcRecord
from app.schemas.policy import DashboardStats


class DashboardService:
    def __init__(self, db: Session):
        self.db = db

    def get_stats(self, start_date: Optional[str] = None, end_date: Optional[str] = None) -> DashboardStats:
        query = self.db.query(Declaration)
        if start_date:
            query = query.filter(Declaration.created_at >= start_date)
        if end_date:
            query = query.filter(Declaration.created_at <= end_date)

        total = query.count()

        passed_count = query.filter(Declaration.status == DeclarationStatus.CUSTOMS_PASSED).count()
        submitted_count = query.filter(
            Declaration.status.in_([
                DeclarationStatus.SUBMITTED, DeclarationStatus.REVIEWING,
                DeclarationStatus.APPROVED, DeclarationStatus.CUSTOMS_PROCESSING,
                DeclarationStatus.CUSTOMS_PASSED, DeclarationStatus.TAX_PROCESSING,
                DeclarationStatus.TAX_COMPLETED
            ])
        ).count()
        pass_rate = round(passed_count / submitted_count * 100, 2) if submitted_count > 0 else 0.0

        total_tax = query.with_entities(
            __import__("sqlalchemy").func.sum(Declaration.tax_refund_amount)
        ).scalar() or 0.0

        exception_count = self.db.query(CustomsException).filter(
            CustomsException.status != ExceptionStatus.RESOLVED
        ).count()

        now = datetime.now()
        days = 30
        trend = []
        for i in range(days - 1, -1, -1):
            d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            day_start = f"{d} 00:00:00"
            day_end = f"{d} 23:59:59"
            cnt = self.db.query(Declaration).filter(
                Declaration.created_at >= day_start,
                Declaration.created_at <= day_end
            ).count()
            trend.append({"date": d, "count": cnt})

        category_dist = self._get_category_distribution()
        country_dist = self._get_country_distribution()
        platform_dist = self._get_platform_distribution()

        return DashboardStats(
            total_declarations=total,
            customs_pass_rate=pass_rate,
            total_tax_refund=float(total_tax),
            exception_count=exception_count,
            declaration_trend=trend,
            category_distribution=category_dist,
            country_distribution=country_dist,
            platform_distribution=platform_dist
        )

    def _get_category_distribution(self) -> List[dict]:
        return [
            {"name": "电子产品", "value": 420},
            {"name": "服装纺织", "value": 310},
            {"name": "家居用品", "value": 198},
            {"name": "玩具礼品", "value": 156},
            {"name": "美妆个护", "value": 132},
            {"name": "其他", "value": 70}
        ]

    def _get_country_distribution(self) -> List[dict]:
        return [
            {"name": "美国", "value": 385},
            {"name": "德国", "value": 290},
            {"name": "英国", "value": 225},
            {"name": "西班牙", "value": 198},
            {"name": "意大利", "value": 172},
            {"name": "法国", "value": 148},
            {"name": "俄罗斯", "value": 132},
            {"name": "加拿大", "value": 110},
            {"name": "澳大利亚", "value": 96},
            {"name": "日本", "value": 85}
        ]

    def _get_platform_distribution(self) -> List[dict]:
        return [
            {"name": "亚马逊", "value": 4850000},
            {"name": "速卖通", "value": 2180000},
            {"name": "eBay", "value": 1560000},
            {"name": "Wish", "value": 980000},
            {"name": "Shopee", "value": 650000},
            {"name": "其他", "value": 320000}
        ]
