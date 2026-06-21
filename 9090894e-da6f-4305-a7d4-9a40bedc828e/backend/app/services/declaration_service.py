import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models.declaration import (
    Declaration, DeclarationItem, DeclarationAttachment, DeclarationStatusHistory,
    DeclarationStatus, DeclarationType
)
from app.schemas.declaration import (
    DeclarationCreate, DeclarationUpdate, DeclarationFilter, Declaration as DeclarationSchema
)
from app.models.user import UserRole


class DeclarationService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def generate_declare_no() -> str:
        now = datetime.now()
        return f"CB{now.year}{now.month:02d}{now.day:02d}{now.hour:02d}{now.minute:02d}{uuid.uuid4().hex[:4].upper()}"

    def _add_status_history(self, declaration_id: str, status: DeclarationStatus, operator: str, remark: Optional[str] = None):
        history = DeclarationStatusHistory(
            id=str(uuid.uuid4()),
            declaration_id=declaration_id,
            status=status,
            operator=operator,
            remark=remark
        )
        self.db.add(history)

    def create(self, data: DeclarationCreate, operator: str = "system") -> Declaration:
        declaration_id = str(uuid.uuid4())
        declare_no = self.generate_declare_no()

        total_amount = sum(item.total_amount for item in data.items)
        tax_refund_amount = total_amount * 0.13

        declaration = Declaration(
            id=declaration_id,
            declare_no=declare_no,
            title=data.title,
            enterprise_name=data.enterprise_name,
            platform=data.platform,
            declare_type=data.declare_type,
            total_amount=total_amount,
            tax_refund_amount=tax_refund_amount,
            remark=data.remark,
            status=DeclarationStatus.SUBMITTED if data.submit_now else DeclarationStatus.DRAFT,
            submitter=operator if data.submit_now else None,
            submitted_at=datetime.utcnow() if data.submit_now else None
        )
        self.db.add(declaration)

        for item_data in data.items:
            item = DeclarationItem(
                id=str(uuid.uuid4()),
                declaration_id=declaration_id,
                **item_data.model_dump()
            )
            self.db.add(item)

        for att_data in data.attachments:
            att = DeclarationAttachment(
                id=str(uuid.uuid4()),
                declaration_id=declaration_id,
                **att_data.model_dump(),
                uploaded_by=operator
            )
            self.db.add(att)

        self._add_status_history(
            declaration_id,
            DeclarationStatus.SUBMITTED if data.submit_now else DeclarationStatus.DRAFT,
            operator
        )

        self.db.commit()
        self.db.refresh(declaration)
        return declaration

    def get_by_id(self, declaration_id: str) -> Optional[Declaration]:
        return self.db.query(Declaration).filter(Declaration.id == declaration_id).first()

    def list(
        self,
        filters: DeclarationFilter,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[List[Declaration], int]:
        query = self.db.query(Declaration)

        if filters.keyword:
            kw = f"%{filters.keyword}%"
            query = query.filter(
                (Declaration.declare_no.ilike(kw))
                | (Declaration.title.ilike(kw))
                | (Declaration.enterprise_name.ilike(kw))
            )
        if filters.status:
            query = query.filter(Declaration.status == filters.status)
        if filters.platform:
            query = query.filter(Declaration.platform == filters.platform)
        if filters.declare_type:
            query = query.filter(Declaration.declare_type == filters.declare_type)
        if filters.enterprise_name:
            query = query.filter(Declaration.enterprise_name.ilike(f"%{filters.enterprise_name}%"))
        if filters.start_date:
            query = query.filter(Declaration.created_at >= filters.start_date)
        if filters.end_date:
            query = query.filter(Declaration.created_at <= filters.end_date)

        total = query.count()
        items = query.order_by(Declaration.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def update(self, declaration_id: str, data: DeclarationUpdate, operator: str) -> Optional[Declaration]:
        declaration = self.get_by_id(declaration_id)
        if not declaration:
            return None

        if declaration.status not in (DeclarationStatus.DRAFT, DeclarationStatus.REJECTED):
            raise ValueError("仅草稿或被驳回状态可编辑")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if key not in ("items", "attachments"):
                setattr(declaration, key, value)

        if "items" in update_data and update_data["items"] is not None:
            self.db.query(DeclarationItem).filter(DeclarationItem.declaration_id == declaration_id).delete()
            total_amount = 0.0
            for item_data in update_data["items"]:
                item = DeclarationItem(
                    id=str(uuid.uuid4()),
                    declaration_id=declaration_id,
                    **item_data
                )
                total_amount += item.total_amount
                self.db.add(item)
            declaration.total_amount = total_amount
            declaration.tax_refund_amount = total_amount * 0.13

        declaration.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(declaration)
        return declaration

    def delete(self, declaration_id: str) -> bool:
        declaration = self.get_by_id(declaration_id)
        if not declaration:
            return False
        if declaration.status != DeclarationStatus.DRAFT:
            raise ValueError("仅草稿状态可删除")
        self.db.delete(declaration)
        self.db.commit()
        return True

    def submit(self, declaration_id: str, operator: str) -> Optional[Declaration]:
        declaration = self.get_by_id(declaration_id)
        if not declaration:
            return None
        if declaration.status != DeclarationStatus.DRAFT:
            raise ValueError("仅草稿状态可提交")

        declaration.status = DeclarationStatus.SUBMITTED
        declaration.submitter = operator
        declaration.submitted_at = datetime.utcnow()
        declaration.updated_at = datetime.utcnow()

        self._add_status_history(declaration_id, DeclarationStatus.SUBMITTED, operator)
        self.db.commit()
        self.db.refresh(declaration)
        return declaration

    def batch_submit(self, ids: List[str], operator: str) -> List[Declaration]:
        results = []
        for did in ids:
            try:
                d = self.submit(did, operator)
                if d:
                    results.append(d)
            except Exception:
                continue
        return results

    def withdraw(self, declaration_id: str, reason: str, operator: str) -> Optional[Declaration]:
        declaration = self.get_by_id(declaration_id)
        if not declaration:
            return None
        if declaration.status in (DeclarationStatus.DRAFT, DeclarationStatus.WITHDRAWN):
            raise ValueError("该状态不可撤回")

        declaration.status = DeclarationStatus.WITHDRAWN
        declaration.withdraw_reason = reason
        declaration.updated_at = datetime.utcnow()

        self._add_status_history(declaration_id, DeclarationStatus.WITHDRAWN, operator, reason)
        self.db.commit()
        self.db.refresh(declaration)
        return declaration

    def review(self, declaration_id: str, approved: bool, comment: Optional[str], operator: str) -> Optional[Declaration]:
        declaration = self.get_by_id(declaration_id)
        if not declaration:
            return None

        declaration.status = DeclarationStatus.APPROVED if approved else DeclarationStatus.REJECTED
        declaration.reviewer = operator
        declaration.review_comment = comment
        declaration.reviewed_at = datetime.utcnow()
        declaration.updated_at = datetime.utcnow()

        self._add_status_history(
            declaration_id,
            DeclarationStatus.APPROVED if approved else DeclarationStatus.REJECTED,
            operator,
            comment
        )
        self.db.commit()
        self.db.refresh(declaration)
        return declaration
