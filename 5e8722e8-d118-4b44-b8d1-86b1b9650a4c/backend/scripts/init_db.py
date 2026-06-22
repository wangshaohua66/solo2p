from app import create_app, db
from app.models import (
    User, Clinic, Doctor, Patient,
    Appointment, MedicalRecord,
    Consumable, ConsumableRecord,
    OrthodonticRecord, ImplantRecord,
)
from datetime import date, datetime, timedelta
import random


def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print('Database tables created successfully.')


def seed_data():
    app = create_app()
    with app.app_context():
        print('Seeding data...')

        if Clinic.query.first():
            print('Data already exists, skipping seed.')
            return

        clinic1 = Clinic(name='中心门诊', address='市中心区88号', phone='010-12345678',
                        departments=['口腔内科', '口腔外科', '正畸科', '修复科', '种植科'])
        clinic2 = Clinic(name='城东门诊', address='城东区56号', phone='010-23456789',
                        departments=['口腔内科', '正畸科', '修复科'])
        clinic3 = Clinic(name='城西门诊', address='城西区123号', phone='010-34567890',
                        departments=['口腔内科', '口腔外科', '种植科'])
        db.session.add_all([clinic1, clinic2, clinic3])
        db.session.flush()

        doctors_data = [
            {'name': '李医生', 'title': '主任医师', 'department': '口腔内科', 'clinic': clinic1, 'specialty': ['根管治疗', '牙周病', '龋齿治疗']},
            {'name': '张医生', 'title': '副主任医师', 'department': '口腔内科', 'clinic': clinic1, 'specialty': ['口腔黏膜病', '儿童牙病']},
            {'name': '王医生', 'title': '主任医师', 'department': '正畸科', 'clinic': clinic1, 'specialty': ['隐形矫正', '儿童正畸', '成人正畸']},
            {'name': '赵医生', 'title': '主任医师', 'department': '种植科', 'clinic': clinic1, 'specialty': ['种植牙', '骨增量', '即刻种植']},
            {'name': '钱医生', 'title': '主治医师', 'department': '修复科', 'clinic': clinic1, 'specialty': ['烤瓷牙', '全瓷冠', '活动义齿']},
            {'name': '周医生', 'title': '副主任医师', 'department': '口腔外科', 'clinic': clinic1, 'specialty': ['拔牙', '智齿', '颌面部手术']},
            {'name': '陈医生', 'title': '主治医师', 'department': '正畸科', 'clinic': clinic2, 'specialty': ['金属托槽', '自锁托槽']},
            {'name': '吴医生', 'title': '副主任医师', 'department': '种植科', 'clinic': clinic3, 'specialty': ['前牙种植', '后牙种植']},
        ]

        for d in doctors_data:
            doctor = Doctor(
                name=d['name'],
                title=d['title'],
                department=d['department'],
                clinic_id=d['clinic'].id,
                rating=round(random.uniform(4.5, 5.0), 1),
                specialty=d['specialty'],
            )
            db.session.add(doctor)

        db.session.flush()

        admin = User(username='admin', name='系统管理员', role='admin')
        admin.set_password('admin123')
        db.session.add(admin)

        doctor_user = User(username='doctor', name='李医生', role='doctor', clinic_id=clinic1.id)
        doctor_user.set_password('123456')
        db.session.add(doctor_user)

        reception_user = User(username='reception', name='前台小王', role='reception', clinic_id=clinic1.id)
        reception_user.set_password('123456')
        db.session.add(reception_user)

        patient_names = [
            '张三', '李四', '王五', '赵六', '孙七', '周八', '吴九', '郑十',
            '陈小明', '刘小红', '杨小刚', '黄小丽', '周小杰', '吴晓芳',
        ]
        patients = []
        for i, name in enumerate(patient_names):
            patient = Patient(
                name=name,
                gender='male' if i % 2 == 0 else 'female',
                age=random.randint(18, 65),
                phone=f'138{random.randint(10000000, 99999999)}',
                address=f'城市某区街道{i+1}号',
                allergies=['青霉素'] if i % 5 == 0 else [],
                medical_history=['高血压'] if i % 7 == 0 else [],
            )
            patients.append(patient)
            db.session.add(patient)

        db.session.flush()

        all_doctors = Doctor.query.all()
        for i, patient in enumerate(patients):
            doctor = all_doctors[i % len(all_doctors)]
            for j in range(random.randint(2, 5)):
                appt_date = date.today() + timedelta(days=random.randint(-30, 30))
                time_slots = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
                slot = time_slots[random.randint(0, len(time_slots) - 1)]
                statuses = ['pending', 'confirmed', 'completed', 'cancelled']
                status = statuses[random.randint(0, len(statuses) - 1)]

                appt = Appointment(
                    patient_id=patient.id,
                    clinic_id=doctor.clinic_id,
                    department=doctor.department,
                    doctor_id=doctor.id,
                    appointment_date=appt_date,
                    time_slot=slot,
                    status=status,
                    appointment_type=random.choice(['初诊', '复诊', '复查']),
                )
                db.session.add(appt)

        db.session.flush()

        consumable_data = [
            {'name': '牙科复合树脂', 'category': '修复材料', 'spec': 'A2色 4g/支', 'unit': '支', 'stock': 25, 'min_stock': 10, 'price': 280},
            {'name': '根管锉', 'category': '器械耗材', 'spec': '25mm #15-40', 'unit': '盒', 'stock': 8, 'min_stock': 15, 'price': 450},
            {'name': '种植体 Nobel Active', 'category': '种植材料', 'spec': '4.3x10mm', 'unit': '颗', 'stock': 12, 'min_stock': 5, 'price': 5800},
            {'name': '金属托槽', 'category': '正畸材料', 'spec': '标准型 0.022', 'unit': '副', 'stock': 30, 'min_stock': 10, 'price': 1200},
            {'name': '一次性手套', 'category': '防护用品', 'spec': 'M号 100只/盒', 'unit': '盒', 'stock': 5, 'min_stock': 20, 'price': 45},
            {'name': '阿替卡因注射液', 'category': '药品', 'spec': '1.7ml/支', 'unit': '支', 'stock': 50, 'min_stock': 30, 'price': 25},
            {'name': '硅橡胶印模材料', 'category': '修复材料', 'spec': '加聚型 重体', 'unit': '套', 'stock': 18, 'min_stock': 8, 'price': 320},
            {'name': '医用外科口罩', 'category': '防护用品', 'spec': '50只/盒', 'unit': '盒', 'stock': 3, 'min_stock': 25, 'price': 35},
            {'name': '牙片机胶片', 'category': '影像耗材', 'spec': '儿童型', 'unit': '片', 'stock': 200, 'min_stock': 100, 'price': 15},
            {'name': '洁牙机工作尖', 'category': '器械耗材', 'spec': '通用型', 'unit': '支', 'stock': 15, 'min_stock': 10, 'price': 180},
        ]

        for c in consumable_data:
            consumable = Consumable(
                name=c['name'],
                category=c['category'],
                spec=c['spec'],
                unit=c['unit'],
                stock=c['stock'],
                min_stock=c['min_stock'],
                price=c['price'],
                clinic_id=clinic1.id,
            )
            db.session.add(consumable)

        db.session.commit()

        for patient in patients[:5]:
            record = MedicalRecord(
                patient_id=patient.id,
                doctor_id=all_doctors[0].id,
                department='口腔内科',
                visit_date=date.today() - timedelta(days=random.randint(1, 30)),
                chief_complaint='牙疼一周，夜间加重',
                present_illness='患者一周前出现自发性疼痛，夜间痛明显，冷热刺激痛',
                past_history='体健，无高血压糖尿病史',
                diagnosis='急性牙髓炎',
                treatment_plan='根管治疗，术后全冠修复',
                prescription=[
                    {'name': '阿莫西林', 'dosage': '0.5g', 'frequency': 'tid', 'duration': '3天'},
                    {'name': '布洛芬', 'dosage': '0.2g', 'frequency': 'prn', 'duration': '3天'},
                ],
            )
            db.session.add(record)

        db.session.commit()
        print('Data seeded successfully.')


if __name__ == '__main__':
    init_db()
    seed_data()
