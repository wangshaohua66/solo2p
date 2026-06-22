import os
import csv
import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import re

from models import (
    db_manager, Registration, Payment,
    PAYMENT_STATUS, PAYMENT_STATUS_NAMES
)
from utils.config import config
from utils.logger import get_logger

logger = get_logger(__name__)


class PaymentService:
    def __init__(self):
        self.default_fee = config.get('payment.default_fee', 300)
        self.receipt_dir = Path(config.get('payment.bank_receipt_dir', 'data/receipts'))
        self.receipt_dir.mkdir(parents=True, exist_ok=True)

    def _generate_payment_no(self) -> str:
        today = datetime.now().strftime('%Y%m%d')
        with db_manager.get_session() as session:
            count = session.query(Payment).filter(
                Payment.payment_no.like(f'PAY{today}%')
            ).count() + 1
        return f'PAY{today}{count:08d}'

    def create_payment_record(self, registration_id: int, amount: float = None,
                              payment_method: str = None) -> Payment:
        if amount is None:
            amount = self.default_fee

        with db_manager.get_session() as session:
            registration = session.query(Registration).get(registration_id)
            if not registration:
                raise ValueError(f"Registration not found: {registration_id}")

            existing = session.query(Payment).filter_by(
                registration_id=registration_id
            ).first()
            if existing:
                logger.info(f"Payment record already exists for registration {registration_id}")
                _ = existing.payment_no, existing.id, existing.status, existing.amount
                session.expunge(existing)
                return existing

            payment = Payment(
                registration_id=registration_id,
                payment_no=self._generate_payment_no(),
                amount=amount,
                status='pending',
                payment_method=payment_method,
            )
            session.add(payment)
            session.flush()

            registration.status = 'payment_pending'
            
            _ = payment.payment_no, payment.id, payment.status, payment.amount
            session.expunge(payment)

        logger.info(f"Payment record created: {payment.payment_no} for registration {registration_id}, amount: {amount}")
        return payment

    def update_payment_status(self, payment_id: int = None, payment_no: str = None,
                              status: str = 'paid', bank_receipt_no: str = None,
                              confirmed_by: str = None, notes: str = None) -> Payment:
        if status not in PAYMENT_STATUS:
            raise ValueError(f"Invalid payment status: {status}")

        with db_manager.get_session() as session:
            if payment_id:
                payment = session.query(Payment).get(payment_id)
            elif payment_no:
                payment = session.query(Payment).filter_by(payment_no=payment_no).first()
            else:
                raise ValueError("Either payment_id or payment_no must be provided")

            if not payment:
                raise ValueError("Payment record not found")

            old_status = payment.status
            payment.status = status
            payment.bank_receipt_no = bank_receipt_no or payment.bank_receipt_no
            payment.confirmed_by = confirmed_by or payment.confirmed_by
            payment.notes = notes or payment.notes

            now = datetime.now()
            if status == 'paid' and old_status != 'paid':
                payment.payment_date = now
                payment.confirmation_date = now

                registration = session.query(Registration).get(payment.registration_id)
                if registration:
                    registration.status = 'payment_confirmed'
                    registration.payment_date = now

            elif status in ['refunded', 'overdue'] and old_status == 'paid':
                registration = session.query(Registration).get(payment.registration_id)
                if registration:
                    registration.status = 'payment_pending'

            _ = payment.payment_no, payment.id, payment.status, payment.amount, payment.registration_id
            session.expunge(payment)

        logger.info(f"Payment {payment.payment_no} status updated: {old_status} -> {status}")
        return payment

    def import_bank_receipts(self, file_path: str) -> Dict:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Bank receipt file not found: {file_path}")

        if not os.access(file_path, os.R_OK):
            raise PermissionError(f"No read permission for file: {file_path}")

        file_ext = Path(file_path).suffix.lower()
        receipts = []

        if file_ext == '.csv':
            receipts = self._parse_csv_receipts(file_path)
        elif file_ext == '.json':
            receipts = self._parse_json_receipts(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")

        matched_count = 0
        unmatched_receipts = []
        errors = []

        with db_manager.get_session() as session:
            for receipt in receipts:
                try:
                    result = self._match_receipt(session, receipt)
                    if result['matched']:
                        matched_count += 1
                    else:
                        unmatched_receipts.append(receipt)
                except Exception as e:
                    errors.append({'receipt': receipt, 'error': str(e)})

        logger.info(f"Bank receipts imported: {len(receipts)} total, "
                    f"{matched_count} matched, {len(unmatched_receipts)} unmatched, "
                    f"{len(errors)} errors")

        return {
            'total': len(receipts),
            'matched': matched_count,
            'unmatched': len(unmatched_receipts),
            'errors': len(errors),
            'unmatched_receipts': unmatched_receipts,
            'error_details': errors,
        }

    def _parse_csv_receipts(self, file_path: str) -> List[Dict]:
        receipts = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                receipt = {
                    'bank_receipt_no': row.get('receipt_no') or row.get('银行回单号') or row.get('回单编号') or '',
                    'amount': float(row.get('amount') or row.get('金额') or 0),
                    'payment_date': self._parse_date(row.get('payment_date') or row.get('交易日期') or row.get('日期')),
                    'payer_name': row.get('payer') or row.get('付款人') or row.get('付款方名称') or '',
                    'remark': row.get('remark') or row.get('备注') or row.get('附言') or '',
                }
                if receipt['bank_receipt_no'] and receipt['amount'] > 0:
                    receipts.append(receipt)
        return receipts

    def _parse_json_receipts(self, file_path: str) -> List[Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        receipts = []
        items = data.get('receipts', data) if isinstance(data, dict) else data
        for item in items:
            receipt = {
                'bank_receipt_no': item.get('bank_receipt_no') or item.get('receipt_no') or '',
                'amount': float(item.get('amount', 0)),
                'payment_date': self._parse_date(item.get('payment_date') or item.get('date')),
                'payer_name': item.get('payer_name') or item.get('payer') or '',
                'remark': item.get('remark') or item.get('notes') or '',
            }
            if receipt['bank_receipt_no'] and receipt['amount'] > 0:
                receipts.append(receipt)
        return receipts

    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None

        formats = [
            '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d',
            '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S',
            '%Y%m%d', '%Y-%m-%d %H:%M',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt)
            except ValueError:
                continue

        logger.warning(f"Unable to parse date: {date_str}")
        return None

    def _match_receipt(self, session, receipt: Dict) -> Dict:
        bank_receipt_no = receipt['bank_receipt_no']
        amount = receipt['amount']
        remark = receipt.get('remark', '')

        application_no_match = re.search(r'(\d{14})', remark) or re.search(r'([A-Z]{2}\d{14})', remark)

        query = session.query(Payment).filter_by(status='pending')

        if bank_receipt_no:
            existing = query.filter_by(bank_receipt_no=bank_receipt_no).first()
            if existing:
                return {'matched': False, 'reason': 'Bank receipt no already used'}

        if application_no_match:
            application_no = application_no_match.group(1)
            registration = session.query(Registration).filter_by(
                application_no=application_no
            ).first()
            if registration:
                payment = session.query(Payment).filter_by(
                    registration_id=registration.id,
                    status='pending'
                ).first()
                if payment and abs(payment.amount - amount) < 0.01:
                    payment.status = 'paid'
                    payment.bank_receipt_no = bank_receipt_no
                    payment.payment_date = receipt.get('payment_date') or datetime.now()
                    payment.confirmation_date = datetime.now()
                    payment.confirmed_by = 'auto_match'
                    payment.notes = f"自动匹配：{remark}"

                    registration.status = 'payment_confirmed'
                    registration.payment_date = payment.payment_date

                    return {'matched': True, 'payment_id': payment.id}

        if receipt.get('payer_name'):
            from models import Applicant
            payments = query.join(Registration).join(Applicant).filter(
                Applicant.name == receipt['payer_name']
            ).all()

            for payment in payments:
                if abs(payment.amount - amount) < 0.01:
                    payment.status = 'paid'
                    payment.bank_receipt_no = bank_receipt_no
                    payment.payment_date = receipt.get('payment_date') or datetime.now()
                    payment.confirmation_date = datetime.now()
                    payment.confirmed_by = 'auto_match'
                    payment.notes = f"按付款人匹配：{receipt['payer_name']}，备注：{remark}"

                    registration = session.query(Registration).get(payment.registration_id)
                    if registration:
                        registration.status = 'payment_confirmed'
                        registration.payment_date = payment.payment_date

                    return {'matched': True, 'payment_id': payment.id}

        return {'matched': False, 'reason': 'No matching payment record found'}

    def get_payment(self, payment_id: int = None, payment_no: str = None,
                    registration_id: int = None) -> Optional[Payment]:
        with db_manager.get_session() as session:
            payment = None
            if payment_id:
                payment = session.query(Payment).get(payment_id)
            elif payment_no:
                payment = session.query(Payment).filter_by(payment_no=payment_no).first()
            elif registration_id:
                payment = session.query(Payment).filter_by(registration_id=registration_id).first()
            
            if payment:
                _ = payment.payment_no, payment.id, payment.status, payment.amount, payment.registration_id
                session.expunge(payment)
            return payment

    def list_payments(self, status: str = None, start_date: date = None,
                      end_date: date = None, limit: int = 100, offset: int = 0) -> List[Dict]:
        with db_manager.get_session() as session:
            query = session.query(Payment)

            if status:
                query = query.filter(Payment.status == status)
            if start_date:
                query = query.filter(Payment.created_at >= datetime.combine(start_date, datetime.min.time()))
            if end_date:
                query = query.filter(Payment.created_at <= datetime.combine(end_date, datetime.max.time()))

            payments = query.order_by(Payment.created_at.desc()).offset(offset).limit(limit).all()
            return [p.to_dict() for p in payments]

    def generate_monthly_report(self, year: int, month: int) -> Dict:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)

        with db_manager.get_session() as session:
            payments = session.query(Payment).filter(
                Payment.created_at >= datetime.combine(start_date, datetime.min.time()),
                Payment.created_at <= datetime.combine(end_date, datetime.max.time()),
            ).all()

            total_count = len(payments)
            paid_count = sum(1 for p in payments if p.status == 'paid')
            pending_count = sum(1 for p in payments if p.status == 'pending')
            refunded_count = sum(1 for p in payments if p.status == 'refunded')
            overdue_count = sum(1 for p in payments if p.status == 'overdue')

            total_amount = sum(p.amount for p in payments)
            paid_amount = sum(p.amount for p in payments if p.status == 'paid')
            pending_amount = sum(p.amount for p in payments if p.status == 'pending')

            payment_methods = {}
            for p in payments:
                method = p.payment_method or 'unknown'
                if method not in payment_methods:
                    payment_methods[method] = {'count': 0, 'amount': 0}
                payment_methods[method]['count'] += 1
                payment_methods[method]['amount'] += p.amount

            daily_stats = {}
            for p in payments:
                day = p.created_at.date().isoformat()
                if day not in daily_stats:
                    daily_stats[day] = {'count': 0, 'amount': 0, 'paid': 0}
                daily_stats[day]['count'] += 1
                daily_stats[day]['amount'] += p.amount
                if p.status == 'paid':
                    daily_stats[day]['paid'] += p.amount

            report = {
                'period': f'{year}年{month}月',
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'generated_at': datetime.now().isoformat(),
                'summary': {
                    'total_count': total_count,
                    'paid_count': paid_count,
                    'pending_count': pending_count,
                    'refunded_count': refunded_count,
                    'overdue_count': overdue_count,
                    'total_amount': round(total_amount, 2),
                    'paid_amount': round(paid_amount, 2),
                    'pending_amount': round(pending_amount, 2),
                    'collection_rate': paid_count / total_count if total_count > 0 else 0,
                    'amount_collection_rate': paid_amount / total_amount if total_amount > 0 else 0,
                },
                'by_payment_method': payment_methods,
                'daily_statistics': daily_stats,
            }

            report_file = self._save_report(report, year, month)
            report['report_file'] = report_file

        logger.info(f"Monthly payment report generated: {year}-{month}, "
                    f"total: {total_count}, paid: {paid_count}, amount: {paid_amount}")
        return report

    def _save_report(self, report: Dict, year: int, month: int) -> str:
        report_dir = self.receipt_dir.parent / 'reports'
        report_dir.mkdir(parents=True, exist_ok=True)

        report_file = report_dir / f'payment_report_{year}_{month:02d}.json'
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        return str(report_file)

    def get_pending_payments(self, days_overdue: int = 30) -> List[Dict]:
        cutoff_date = date.today() - timedelta(days=days_overdue)
        with db_manager.get_session() as session:
            payments = session.query(Payment).filter(
                Payment.status == 'pending',
                Payment.created_at <= datetime.combine(cutoff_date, datetime.max.time()),
            ).join(Registration).all()

            results = []
            for p in payments:
                reg = session.query(Registration).get(p.registration_id)
                is_overdue = p.created_at.date() < cutoff_date
                results.append({
                    'payment_id': p.id,
                    'payment_no': p.payment_no,
                    'application_no': reg.application_no if reg else '',
                    'applicant_name': reg.applicant.name if reg and reg.applicant else '',
                    'work_title': reg.work.title if reg and reg.work else '',
                    'amount': p.amount,
                    'created_at': p.created_at.isoformat(),
                    'days_pending': (date.today() - p.created_at.date()).days,
                    'is_overdue': is_overdue,
                })
            return results

    def mark_overdue(self, days: int = 30) -> int:
        cutoff_date = date.today() - timedelta(days=days)
        count = 0
        with db_manager.get_session() as session:
            payments = session.query(Payment).filter(
                Payment.status == 'pending',
                Payment.created_at <= datetime.combine(cutoff_date, datetime.max.time()),
            ).all()

            for p in payments:
                p.status = 'overdue'
                reg = session.query(Registration).get(p.registration_id)
                if reg:
                    reg.status = 'rejected'
                    reg.rejection_reason = f'缴费逾期超过{days}天，自动驳回'
                count += 1

        if count > 0:
            logger.info(f"Marked {count} payments as overdue (>{days} days)")
        return count

    def reconcile(self, start_date: date = None, end_date: date = None) -> Dict:
        if start_date is None:
            start_date = date.today().replace(day=1)
        if end_date is None:
            end_date = date.today()

        with db_manager.get_session() as session:
            payments = session.query(Payment).filter(
                Payment.created_at >= datetime.combine(start_date, datetime.min.time()),
                Payment.created_at <= datetime.combine(end_date, datetime.max.time()),
            ).all()

            bank_payments = [p for p in payments if p.bank_receipt_no and p.status == 'paid']
            system_payments = [p for p in payments if p.status == 'paid']

            unmatched_bank = [p for p in bank_payments if not p.registration_id]
            unmatched_system = [p for p in system_payments if not p.bank_receipt_no]

            bank_total = sum(p.amount for p in bank_payments)
            system_total = sum(p.amount for p in system_payments)

            return {
                'period': f'{start_date.isoformat()} to {end_date.isoformat()}',
                'bank_payments_count': len(bank_payments),
                'system_payments_count': len(system_payments),
                'bank_total_amount': round(bank_total, 2),
                'system_total_amount': round(system_total, 2),
                'difference': round(bank_total - system_total, 2),
                'unmatched_bank_count': len(unmatched_bank),
                'unmatched_system_count': len(unmatched_system),
                'is_balanced': abs(bank_total - system_total) < 0.01 and len(unmatched_bank) == 0 and len(unmatched_system) == 0,
            }
