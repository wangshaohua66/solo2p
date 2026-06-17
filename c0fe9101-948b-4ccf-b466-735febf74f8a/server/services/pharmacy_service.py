from datetime import datetime, timedelta
from sqlalchemy import and_, desc, func
from models import db, Medicine, Prescription, PrescriptionItem, StockLog, User, Hospital
from services.auth_service import create_notification, batch_create_notifications


class PharmacyService:

    @staticmethod
    def get_medicines(hospital_id=None, category=None, is_controlled=None, is_low_stock=False,
                      keyword=None, is_active=True, page=1, per_page=50):
        query = Medicine.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        if category:
            query = query.filter_by(category=category)
        if is_controlled is not None:
            query = query.filter_by(is_controlled=is_controlled)
        if is_low_stock:
            query = query.filter(Medicine.stock_quantity <= Medicine.safety_stock)
        if keyword:
            like = f'%{keyword}%'
            query = query.filter(
                Medicine.name.ilike(like) |
                Medicine.generic_name.ilike(like) |
                Medicine.batch_number.ilike(like)
            )
        total = query.count()
        medicines = query.order_by(Medicine.name).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [m.to_dict() for m in medicines]
        }

    @staticmethod
    def get_low_stock_medicines(hospital_id=None):
        return Medicine.query.filter(
            Medicine.stock_quantity <= Medicine.safety_stock,
            Medicine.is_active == True
        ).order_by(Medicine.stock_quantity).all()

    @staticmethod
    def create_medicine(data):
        existing = Medicine.query.filter_by(
            name=data['name'],
            spec=data.get('spec', ''),
            batch_number=data.get('batch_number', '')
        ).first()
        if existing:
            return None, '药品已存在'

        medicine = Medicine(
            name=data['name'],
            generic_name=data.get('generic_name'),
            spec=data.get('spec'),
            manufacturer=data.get('manufacturer'),
            batch_number=data.get('batch_number'),
            category=data.get('category', 'other'),
            is_controlled=data.get('is_controlled', False),
            is_prescription=data.get('is_prescription', True),
            unit=data.get('unit', 'box'),
            stock_quantity=data.get('stock_quantity', 0),
            safety_stock=data.get('safety_stock', 10),
            unit_price=data.get('unit_price', 0),
            expiry_date=datetime.fromisoformat(data['expiry_date']).date() if data.get('expiry_date') else None,
            storage_condition=data.get('storage_condition'),
            is_active=data.get('is_active', True)
        )
        db.session.add(medicine)

        if medicine.stock_quantity > 0:
            log = StockLog(
                medicine_id=medicine.id,
                change_type='purchase',
                quantity_change=medicine.stock_quantity,
                balance_after=medicine.stock_quantity,
                hospital_id=data.get('hospital_id'),
                remark='初始入库'
            )
            db.session.add(log)

        db.session.commit()
        return medicine, None

    @staticmethod
    def update_stock(medicine_id, quantity_change, change_type, operator_id, hospital_id=None,
                     related_type=None, related_id=None, remark=None):
        medicine = Medicine.query.get(medicine_id)
        if not medicine:
            return None, '药品不存在'

        new_balance = medicine.stock_quantity + quantity_change
        if new_balance < 0:
            return None, '库存不足'

        medicine.stock_quantity = new_balance

        log = StockLog(
            medicine_id=medicine_id,
            hospital_id=hospital_id,
            change_type=change_type,
            quantity_change=quantity_change,
            balance_after=new_balance,
            related_type=related_type,
            related_id=related_id,
            operator_id=operator_id,
            remark=remark
        )
        db.session.add(log)

        was_low = (medicine.stock_quantity - quantity_change) <= medicine.safety_stock
        is_now_low = new_balance <= medicine.safety_stock

        if not was_low and is_now_low:
            pharmacists = User.query.filter_by(role='pharmacist', is_active=True).all()
            pharmacist_ids = [p.id for p in pharmacists]
            batch_create_notifications(
                user_ids=pharmacist_ids,
                type='system',
                title='药品库存预警',
                content=f'药品【{medicine.name}】库存已降至阈值以下，当前库存：{new_balance}',
                priority='high'
            )

        db.session.commit()
        return log, None

    @staticmethod
    def create_prescription(data, prescribed_by_id):
        has_controlled = False
        items_data = data.get('items', [])
        for item in items_data:
            medicine = Medicine.query.get(item.get('medicine_id'))
            if medicine and medicine.is_controlled:
                has_controlled = True
                break

        prescription = Prescription(
            medical_record_id=data.get('medical_record_id'),
            hospital_id=data.get('hospital_id'),
            prescribed_by_id=prescribed_by_id,
            has_controlled=has_controlled,
            status='pending',
            remark=data.get('remark')
        )
        db.session.add(prescription)
        db.session.flush()

        total_amount = 0
        for item_data in items_data:
            medicine = Medicine.query.get(item_data.get('medicine_id'))
            if not medicine:
                continue
            unit_price = medicine.unit_price
            qty = float(item_data.get('quantity', 0))
            subtotal = round(unit_price * qty, 2)
            total_amount += subtotal

            item = PrescriptionItem(
                prescription_id=prescription.id,
                medicine_id=medicine.id,
                dosage=item_data.get('dosage'),
                quantity=qty,
                unit_price=unit_price,
                subtotal=subtotal,
                remark=item_data.get('remark')
            )
            db.session.add(item)

        prescription.total_amount = total_amount
        db.session.commit()

        return prescription

    @staticmethod
    def approve_prescription(prescription_id, approver_id, approval_level):
        prescription = Prescription.query.get(prescription_id)
        if not prescription:
            return None, '处方不存在'

        if prescription.prescribed_by_id == approver_id:
            return None, '处方开具人不可参与审核'

        if approval_level == 1:
            if prescription.first_approver_id:
                return None, '已通过一审'
            prescription.first_approver_id = approver_id
            if prescription.has_controlled:
                prescription.status = 'first_approved'
            else:
                prescription.status = 'second_approved'
        elif approval_level == 2:
            if not prescription.has_controlled:
                prescription.status = 'second_approved'
            elif prescription.status != 'first_approved':
                return None, '需先通过一审'
            elif prescription.second_approver_id:
                return None, '已通过二审'
            elif not prescription.first_approver_id:
                return None, '需先通过一审'
            elif prescription.first_approver_id == approver_id:
                return None, '二审审核人不可与一审审核人相同，请更换审核人'
            else:
                prescription.second_approver_id = approver_id
                prescription.status = 'second_approved'
        else:
            return None, '无效的审核级别'

        db.session.commit()

        if prescription.status == 'second_approved' and prescription.prescribed_by_id:
            create_notification(
                user_id=prescription.prescribed_by_id,
                type='prescription',
                title='处方审核通过',
                content=f'处方#{prescription.id}已{"完成双人" if prescription.has_controlled else ""}审核，可发药',
                related_type='Prescription',
                related_id=prescription.id
            )

        return prescription, None

    @staticmethod
    def dispense_prescription(prescription_id, dispenser_id, hospital_id=None):
        prescription = Prescription.query.get(prescription_id)
        if not prescription:
            return None, '处方不存在'
        if prescription.status != 'second_approved':
            return None, f'处方状态为{prescription.status}，不可发药'
        if prescription.status == 'dispensed':
            return None, '处方已发药'

        insufficient = []
        for item in prescription.items:
            med = Medicine.query.get(item.medicine_id)
            if not med or med.stock_quantity < item.quantity:
                insufficient.append(med.name if med else '未知药品')
        if insufficient:
            return None, f'库存不足：{", ".join(insufficient)}'

        for item in prescription.items:
            PharmacyService.update_stock(
                medicine_id=item.medicine_id,
                quantity_change=-item.quantity,
                change_type='dispense',
                operator_id=dispenser_id,
                hospital_id=hospital_id,
                related_type='Prescription',
                related_id=prescription.id,
                remark=f'处方#{prescription.id}发药'
            )

        prescription.status = 'dispensed'
        prescription.dispense_date = datetime.utcnow()
        prescription.dispensed_by_id = dispenser_id
        db.session.commit()

        return prescription, None

    @staticmethod
    def search_prescriptions(hospital_id=None, status=None, has_controlled=None, prescribed_by_id=None,
                             medical_record_id=None, start_date=None, end_date=None,
                             page=1, per_page=20):
        query = Prescription.query
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if status:
            query = query.filter_by(status=status)
        if has_controlled is not None:
            query = query.filter_by(has_controlled=has_controlled)
        if prescribed_by_id:
            query = query.filter_by(prescribed_by_id=prescribed_by_id)
        if medical_record_id:
            query = query.filter_by(medical_record_id=medical_record_id)
        if start_date:
            query = query.filter(Prescription.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(Prescription.created_at <= datetime.fromisoformat(end_date))

        total = query.count()
        records = query.order_by(desc(Prescription.created_at)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [r.to_dict(include_items=True) for r in records]
        }

    @staticmethod
    def get_stock_logs(medicine_id=None, hospital_id=None, change_type=None,
                       start_date=None, end_date=None, page=1, per_page=50):
        query = StockLog.query
        if medicine_id:
            query = query.filter_by(medicine_id=medicine_id)
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        if change_type:
            query = query.filter_by(change_type=change_type)
        if start_date:
            query = query.filter(StockLog.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(StockLog.created_at <= datetime.fromisoformat(end_date))

        total = query.count()
        logs = query.order_by(desc(StockLog.created_at)).offset((page - 1) * per_page).limit(per_page).all()
        return {
            'total': total,
            'page': page,
            'per_page': per_page,
            'items': [l.to_dict() for l in logs]
        }
