import uuid
import random
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.declaration import Declaration, DeclarationStatus, DeclarationStatusHistory
from app.models.customs import CustomsException, ExceptionStatus
from app.config import get_settings

settings = get_settings()


class CustomsApiService:
    """
    海关单一窗口接口对接服务
    模拟真实海关接口：申报单状态查询、清单核对、异常反馈
    """

    CUSTOMS_API_BASE = "https://api.customs.gov.cn/single-window"

    def __init__(self, db: Session):
        self.db = db

    async def _mock_api_call(self, endpoint: str, payload: Dict[str, Any], delay: float = 0.3) -> Dict[str, Any]:
        """模拟海关API调用，带随机延迟"""
        await asyncio.sleep(delay + random.random() * 0.2)
        return {"code": 0, "message": "success", "data": {}}

    async def declare_status_query(self, declare_no: str) -> Dict[str, Any]:
        """
        查询申报单海关通关状态
        对应海关单一窗口：清单状态查询接口
        """
        declaration = self.db.query(Declaration).filter(
            Declaration.declare_no == declare_no
        ).first()

        if not declaration:
            return {"code": 404, "message": "申报单不存在", "data": None}

        current_status = declaration.status
        next_status = current_status
        status_text = ""
        customs_code = ""

        status_map = {
            DeclarationStatus.APPROVED: {
                "next": DeclarationStatus.CUSTOMS_PROCESSING,
                "text": "海关已接单，正在审核",
                "code": "CUSTOMS_RECEIVED"
            },
            DeclarationStatus.CUSTOMS_PROCESSING: {
                "next": DeclarationStatus.CUSTOMS_PASSED,
                "text": "海关审核通过，已放行",
                "code": "CUSTOMS_RELEASED"
            },
            DeclarationStatus.CUSTOMS_PASSED: {
                "next": DeclarationStatus.TAX_PROCESSING,
                "text": "已进入出口退税流程",
                "code": "TAX_PROCESSING"
            }
        }

        if current_status in status_map and random.random() > 0.15:
            transition = status_map[current_status]
            next_status = transition["next"]
            status_text = transition["text"]
            customs_code = transition["code"]
            declaration.status = next_status
            declaration.updated_at = datetime.utcnow()
            if next_status == DeclarationStatus.CUSTOMS_PASSED:
                declaration.customs_passed_at = datetime.utcnow()
            elif next_status == DeclarationStatus.TAX_PROCESSING:
                from app.services.tax_service import TaxService
                pass

            history = DeclarationStatusHistory(
                id=str(uuid.uuid4()),
                declaration_id=declaration.id,
                status=next_status,
                operator="海关系统",
                remark=status_text
            )
            self.db.add(history)
            self.db.commit()

            if random.random() < 0.1 and current_status == DeclarationStatus.CUSTOMS_PROCESSING:
                return await self._generate_exception(declaration)
        else:
            status_text = self._get_status_text(current_status)

        return {
            "code": 0,
            "message": "查询成功",
            "data": {
                "declare_no": declare_no,
                "current_status": next_status.value if hasattr(next_status, 'value') else str(next_status),
                "status_text": status_text,
                "customs_code": customs_code,
                "query_time": datetime.utcnow().isoformat()
            }
        }

    def _get_status_text(self, status: DeclarationStatus) -> str:
        text_map = {
            DeclarationStatus.DRAFT: "草稿未提交",
            DeclarationStatus.SUBMITTED: "运营中心已受理",
            DeclarationStatus.REVIEWING: "运营中心审核中",
            DeclarationStatus.APPROVED: "审核通过，待海关接单",
            DeclarationStatus.REJECTED: "审核驳回",
            DeclarationStatus.CUSTOMS_PROCESSING: "海关审核中",
            DeclarationStatus.CUSTOMS_PASSED: "海关放行",
            DeclarationStatus.CUSTOMS_EXCEPTION: "通关异常",
            DeclarationStatus.TAX_PROCESSING: "退税审核中",
            DeclarationStatus.TAX_COMPLETED: "退税完成",
            DeclarationStatus.WITHDRAWN: "已撤回"
        }
        return text_map.get(status, "未知状态")

    async def _generate_exception(self, declaration: Declaration) -> Dict[str, Any]:
        """模拟生成通关异常案件"""
        exception_types = [
            ("单证不符", "HS编码归类与实际货物不符，需补充商品资料"),
            ("价格质疑", "海关对申报价格有疑问，需提供交易凭证"),
            ("原产地证缺失", "涉及协定税率，需提供原产地证书"),
            ("数量差异", "查验发现实际数量与申报数量不符"),
            ("禁限类商品", "申报商品属出口管制类，需提供出口许可证")
        ]
        exc_type, desc = random.choice(exception_types)

        declaration.status = DeclarationStatus.CUSTOMS_EXCEPTION
        declaration.updated_at = datetime.utcnow()

        history = DeclarationStatusHistory(
            id=str(uuid.uuid4()),
            declaration_id=declaration.id,
            status=DeclarationStatus.CUSTOMS_EXCEPTION,
            operator="海关系统",
            remark=f"{exc_type}：{desc}"
        )
        self.db.add(history)

        exception = CustomsException(
            id=str(uuid.uuid4()),
            declare_no=declaration.declare_no,
            declaration_id=declaration.id,
            exception_type=exc_type,
            description=desc,
            status=ExceptionStatus.PENDING,
            suggestion="请企业核实相关资料后补充提交，或联系海关说明情况",
            reported_at=datetime.utcnow()
        )
        self.db.add(exception)
        self.db.commit()
        self.db.refresh(exception)

        return {
            "code": 1,
            "message": "通关异常",
            "data": {
                "declare_no": declaration.declare_no,
                "current_status": DeclarationStatus.CUSTOMS_EXCEPTION.value,
                "status_text": f"通关异常：{exc_type}",
                "exception_id": exception.id,
                "exception_type": exc_type,
                "description": desc
            }
        }

    async def sync_batch_status(self, declare_nos: List[str]) -> Dict[str, Any]:
        """批量同步通关状态"""
        results = []
        for no in declare_nos:
            res = await self.declare_status_query(no)
            results.append(res.get("data"))
        return {"code": 0, "message": "批量同步完成", "data": results, "count": len(results)}

    async def redeclare(self, exception_id: str) -> Dict[str, Any]:
        """
        异常处理后重新申报
        对应海关：修改后重新申报接口
        """
        exception = self.db.query(CustomsException).filter(
            CustomsException.id == exception_id
        ).first()

        if not exception:
            return {"code": 404, "message": "异常记录不存在", "data": None}

        declaration = self.db.query(Declaration).filter(
            Declaration.declare_no == exception.declare_no
        ).first()

        if not declaration:
            return {"code": 404, "message": "申报单不存在", "data": None}

        declaration.status = DeclarationStatus.SUBMITTED
        declaration.updated_at = datetime.utcnow()

        exception.status = ExceptionStatus.RESOLVED
        exception.resolved_at = datetime.utcnow()
        exception.resolve_note = "企业重新申报"

        history = DeclarationStatusHistory(
            id=str(uuid.uuid4()),
            declaration_id=declaration.id,
            status=DeclarationStatus.SUBMITTED,
            operator="企业申报员",
            remark="异常处理后重新提交申报"
        )
        self.db.add(history)
        self.db.commit()
        self.db.refresh(declaration)

        return {
            "code": 0,
            "message": "重新申报成功，已进入审核流程",
            "data": {"declare_no": declaration.declare_no, "new_status": declaration.status.value}
        }

    async def get_customs_detail(self, declare_no: str) -> Dict[str, Any]:
        """获取海关详细通关信息（报关单、查验记录等）"""
        declaration = self.db.query(Declaration).filter(
            Declaration.declare_no == declare_no
        ).first()

        if not declaration:
            return {"code": 404, "message": "申报单不存在", "data": None}

        customs_data = {
            "declare_no": declare_no,
            "customs_bill_no": f"HG{datetime.now().strftime('%Y%m%d')}{random.randint(10000, 99999)}",
            "customs_site": "杭州海关",
            "declaration_port": "萧山机场海关",
            "trade_mode": "一般贸易",
            "transport_mode": "空运",
            "i_e_flag": "出口",
            "customs_value": declaration.total_amount * 7.25,
            "customs_currency": "CNY",
            "status": declaration.status.value,
            "status_text": self._get_status_text(declaration.status),
            "inspection_required": random.choice([True, False, False]),
            "release_time": declaration.customs_passed_at.isoformat() if declaration.customs_passed_at else None,
            "process_nodes": [
                {"node": "企业申报", "time": declaration.submitted_at.isoformat() if declaration.submitted_at else None, "status": "completed"},
                {"node": "运营审核", "time": declaration.reviewed_at.isoformat() if declaration.reviewed_at else None, "status": "completed" if declaration.reviewed_at else "pending"},
                {"node": "海关接单", "time": None, "status": "completed" if declaration.status in [DeclarationStatus.CUSTOMS_PROCESSING, DeclarationStatus.CUSTOMS_PASSED, DeclarationStatus.CUSTOMS_EXCEPTION] else "pending"},
                {"node": "海关审核", "time": None, "status": "completed" if declaration.status in [DeclarationStatus.CUSTOMS_PASSED, DeclarationStatus.CUSTOMS_EXCEPTION] else "processing" if declaration.status == DeclarationStatus.CUSTOMS_PROCESSING else "pending"},
                {"node": "海关放行", "time": declaration.customs_passed_at.isoformat() if declaration.customs_passed_at else None, "status": "completed" if declaration.customs_passed_at else "pending"}
            ]
        }
        return {"code": 0, "message": "查询成功", "data": customs_data}
