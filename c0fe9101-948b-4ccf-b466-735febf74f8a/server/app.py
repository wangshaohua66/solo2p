import os
import sys
import logging
from datetime import datetime, timedelta, date
from dotenv import load_dotenv
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import db, User, Hospital, Department, Medicine, LabTest, Pet, Owner, Cage
from api.auth_api import auth_bp
from api.medical_api import medical_bp
from api.hospitalization_api import hospitalization_bp
from api.lab_api import lab_bp
from api.pharmacy_api import pharmacy_bp
from api.schedule_api import schedule_bp
from api.report_api import report_bp


def create_app():
    app = Flask(__name__, static_folder='static', instance_relative_config=False)

    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
    app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-dev-secret')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=12)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
    app.config['JSON_AS_ASCII'] = False

    db_host = os.environ.get('DB_HOST', 'localhost')
    db_port = os.environ.get('DB_PORT', '3306')
    db_user = os.environ.get('DB_USER', 'root')
    db_password = os.environ.get('DB_PASSWORD', 'password')
    db_name = os.environ.get('DB_NAME', 'pet_medical')

    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        f'mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_POOL_SIZE'] = 20
    app.config['SQLALCHEMY_MAX_OVERFLOW'] = 30
    app.config['SQLALCHEMY_POOL_RECYCLE'] = 3600

    upload_folder = os.environ.get('UPLOAD_FOLDER', 'uploads')
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), upload_folder)
    app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(medical_bp)
    app.register_blueprint(hospitalization_bp)
    app.register_blueprint(lab_bp)
    app.register_blueprint(pharmacy_bp)
    app.register_blueprint(schedule_bp)
    app.register_blueprint(report_bp)

    @app.route('/')
    def index():
        return jsonify({
            'app': 'Pet Medical Management System',
            'version': '1.0.0',
            'status': 'running',
            'time': datetime.utcnow().isoformat()
        })

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    @app.route('/api/health')
    def health():
        return jsonify({
            'code': 200,
            'status': 'ok',
            'database': 'connected' if db.engine else 'disconnected',
            'time': datetime.utcnow().isoformat()
        })

    @app.errorhandler(HTTPException)
    def handle_http_error(e):
        return jsonify({
            'code': e.code,
            'message': e.description,
            'error': str(e)
        }), e.code

    @app.errorhandler(Exception)
    def handle_exception(e):
        app.logger.exception(f'Unhandled exception: {str(e)}')
        return jsonify({
            'code': 500,
            'message': '服务器内部错误',
            'error': str(e) if app.debug else None
        }), 500

    with app.app_context():
        try:
            db.engine.execute('SELECT 1')
            app.logger.info('Database connection OK')
        except Exception as e:
            app.logger.warning(f'Database not ready: {str(e)}')

        if os.environ.get('AUTO_SEED', 'true').lower() == 'true':
            try:
                seed_data(app)
            except Exception as e:
                app.logger.warning(f'Seed data skipped: {str(e)}')

    return app


def seed_data(app):
    inspector = db.inspect(db.engine)
    tables = inspector.get_table_names()

    if not tables:
        db.create_all()
        app.logger.info('Database tables created')

    if Hospital.query.count() == 0:
        hospitals = [
            Hospital(name='总院-和平路宠物医院', address='和平路128号', phone='010-88880001', type='normal',
                     latitude=39.9087, longitude=116.3975),
            Hospital(name='朝阳路24H急诊中心', address='朝阳路58号', phone='010-88880002', type='emergency_24h',
                     latitude=39.9219, longitude=116.4439),
            Hospital(name='海淀分院', address='海淀大街66号', phone='010-88880003', type='normal',
                     latitude=39.9599, longitude=116.2981),
            Hospital(name='西城分院', address='西直门内大街200号', phone='010-88880004', type='normal',
                     latitude=39.9422, longitude=116.3660),
            Hospital(name='丰台24H急诊中心', address='丰台南路100号', phone='010-88880005', type='emergency_24h',
                     latitude=39.8419, longitude=116.2869),
            Hospital(name='东城分院', address='东四十条88号', phone='010-88880006', type='normal',
                     latitude=39.9355, longitude=116.4236),
            Hospital(name='通州分院', address='新华大街300号', phone='010-88880007', type='normal',
                     latitude=39.9091, longitude=116.6579),
            Hospital(name='昌平24H急诊中心', address='府学路50号', phone='010-88880008', type='emergency_24h',
                     latitude=40.2208, longitude=116.2312),
            Hospital(name='石景山分院', address='石景山路150号', phone='010-88880009', type='normal',
                     latitude=39.9067, longitude=116.2228),
            Hospital(name='大兴分院', address='兴丰大街220号', phone='010-88880010', type='normal',
                     latitude=39.7280, longitude=116.3427),
            Hospital(name='顺义24H急诊中心', address='府前中街60号', phone='010-88880011', type='emergency_24h',
                     latitude=40.1305, longitude=116.6535),
            Hospital(name='房山分院', address='良乡西路180号', phone='010-88880012', type='normal',
                     latitude=39.7351, longitude=116.1442),
            Hospital(name='宣武分院', address='宣武门外大街80号', phone='010-88880013', type='normal',
                     latitude=39.8968, longitude=116.3713),
            Hospital(name='密云24H急诊中心', address='鼓楼西大街100号', phone='010-88880014', type='emergency_24h',
                     latitude=40.3772, longitude=116.8435),
            Hospital(name='怀柔分院', address='青春路90号', phone='010-88880015', type='normal',
                     latitude=40.3161, longitude=116.6323),
            Hospital(name='平谷分院', address='府前街70号', phone='010-88880016', type='normal',
                     latitude=40.1445, longitude=117.1123),
            Hospital(name='延庆24H急诊中心', address='东外大街40号', phone='010-88880017', type='emergency_24h',
                     latitude=40.4650, longitude=115.9753),
        ]
        db.session.bulk_save_objects(hospitals)
        db.session.commit()
        app.logger.info(f'Seeded {len(hospitals)} hospitals')

    dept_names = ['内科', '外科', '影像科', '检验科']
    if Department.query.count() == 0:
        for h in Hospital.query.all():
            for name in dept_names:
                db.session.add(Department(hospital_id=h.id, name=name, description=f'{h.name}-{name}'))
        db.session.commit()
        app.logger.info('Seeded departments')

    if User.query.count() == 0:
        hospitals = Hospital.query.all()
        roles_config = [
            ('director', 2, '集团医疗总监'),
            ('manager', len(hospitals), '院长'),
            ('doctor', 80, '医生'),
            ('nurse', 40, '护理员'),
            ('lab_tech', 15, '检验技师'),
            ('pharmacist', 12, '药房管理员'),
        ]
        first_names = ['张', '李', '王', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡']
        last_names = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平']
        import random
        random.seed(42)

        idx = 1
        users = []
        for role, count, title in roles_config:
            for i in range(count):
                h_idx = 0 if role == 'director' else (i % len(hospitals))
                hospital = hospitals[h_idx]
                dept = random.choice(dept_names) if role in ('doctor', 'nurse', 'lab_tech') else None
                name = random.choice(first_names) + random.choice(last_names)
                user = User(
                    username=f'{role}{idx:03d}',
                    real_name=name,
                    role=role,
                    hospital_id=hospital.id if role != 'director' else None,
                    department=dept,
                    phone=f'138{random.randint(10000000, 99999999)}',
                    email=f'{role}{idx:03d}@petmed.com',
                    qualification=f'{title}执业资格证#{idx:06d}',
                    weekly_max_hours=48
                )
                user.set_password('123456')
                users.append(user)
                idx += 1
        db.session.bulk_save_objects(users)
        db.session.commit()
        app.logger.info(f'Seeded {len(users)} users')

        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                real_name='系统管理员',
                role='director',
                phone='13900000000',
                email='admin@petmed.com',
                qualification='系统管理员',
                weekly_max_hours=60
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()

    if Cage.query.count() == 0:
        zones = ['A区-标准', 'B区-标准', 'C区-ICU', 'D区-隔离', 'E区-急诊']
        types_map = {'A': 'standard', 'B': 'standard', 'C': 'ICU', 'D': 'isolation', 'E': 'emergency'}
        sizes = ['small', 'medium', 'large']
        import random
        random.seed(100)
        cages = []
        for h in hospitals:
            cage_count = 30 if h.type == 'emergency_24h' else 20
            for i in range(cage_count):
                zone_idx = i // (cage_count // len(zones)) if i < cage_count else 0
                zone_idx = min(zone_idx, len(zones) - 1)
                zone_letter = zones[zone_idx][0]
                cages.append(Cage(
                    hospital_id=h.id,
                    zone=zones[zone_idx],
                    code=f'{zone_letter}{i % (cage_count // len(zones)) + 1:02d}',
                    type=types_map.get(zone_letter, 'standard'),
                    size=random.choice(sizes),
                    status=random.choices(['available', 'available', 'available', 'occupied', 'reserved'], weights=[5, 5, 5, 2, 1])[0]
                ))
        db.session.bulk_save_objects(cages)
        db.session.commit()
        app.logger.info(f'Seeded {len(cages)} cages')

    if Medicine.query.count() == 0:
        meds_data = [
            ('阿莫西林克拉维酸钾', 'Amoxicillin', '500mg*12片', '辉瑞', 'B2024001', 'antibiotic', False, True, 'box', 200, 50, 68.5),
            ('头孢氨苄', 'Cephalexin', '250mg*24粒', '拜耳', 'B2024002', 'antibiotic', False, True, 'box', 150, 40, 52.0),
            ('美洛昔康', 'Meloxicam', '7.5mg*10片', '勃林格', 'B2024003', 'analgesic', False, True, 'box', 180, 30, 45.8),
            ('卡洛芬', 'Carprofen', '100mg*30片', '诺华', 'B2024004', 'analgesic', False, True, 'bottle', 80, 20, 128.0),
            ('地西泮', 'Diazepam', '5mg*100片', '国药', 'B2024005', 'psychotropic', True, True, 'bottle', 60, 10, 35.0),
            ('氯胺酮', 'Ketamine', '100mg/2ml', '恒瑞', 'B2024006', 'psychotropic', True, True, 'bottle', 40, 10, 88.0),
            ('芬太尼', 'Fentanyl', '0.1mg/2ml', '人福', 'B2024007', 'psychotropic', True, True, 'ampoule', 25, 5, 156.0),
            ('复合维生素B', 'Vitamin B Complex', '100片', '民生', 'B2024008', 'vitamin', False, False, 'bottle', 500, 100, 12.5),
            ('益生菌', 'Probiotic', '5g*20袋', '麦德氏', 'B2024009', 'other', False, False, 'box', 300, 80, 88.0),
            ('恩诺沙星', 'Enrofloxacin', '5% 100ml', '拜耳', 'B2024010', 'antibiotic', False, True, 'bottle', 120, 30, 78.0),
            ('伊维菌素', 'Ivermectin', '1% 50ml', '梅里亚', 'B2024011', 'other', False, True, 'bottle', 90, 25, 65.0),
            ('甲硝唑', 'Metronidazole', '250mg*100片', '国药', 'B2024012', 'antibiotic', False, True, 'bottle', 250, 60, 22.0),
            ('奥美拉唑', 'Omeprazole', '20mg*14粒', '阿斯利康', 'B2024013', 'other', False, True, 'box', 160, 40, 48.0),
            ('氨茶碱', 'Aminophylline', '100mg*100片', '国药', 'B2024014', 'other', False, True, 'bottle', 80, 20, 18.0),
            ('呋塞米', 'Furosemide', '40mg*100片', '国药', 'B2024015', 'other', False, True, 'bottle', 100, 25, 28.0),
            ('苯巴比妥', 'Phenobarbital', '30mg*100片', '国药', 'B2024016', 'psychotropic', True, True, 'bottle', 50, 10, 42.0),
            ('布洛芬', 'Ibuprofen', '200mg*24片', '中美史克', 'B2024017', 'analgesic', False, False, 'box', 5, 15, 18.0),
            ('肝素钠', 'Heparin Sodium', '12500IU/2ml', '国药', 'B2024018', 'other', False, True, 'ampoule', 30, 8, 32.0),
            ('葡萄糖酸钙', 'Calcium Gluconate', '10% 10ml*5支', '国药', 'B2024019', 'vitamin', False, False, 'box', 80, 20, 15.0),
            ('胰岛素', 'Insulin', '40IU/ml 10ml', '礼来', 'B2024020', 'other', True, True, 'bottle', 15, 5, 198.0),
        ]
        from datetime import date as d
        meds = []
        for name, generic, spec, manu, batch, cat, ctrl, rx, unit, stock, safety, price in meds_data:
            meds.append(Medicine(
                name=name, generic_name=generic, spec=spec, manufacturer=manu, batch_number=batch,
                category=cat, is_controlled=ctrl, is_prescription=rx, unit=unit,
                stock_quantity=stock, safety_stock=safety, unit_price=price,
                expiry_date=d(2026, 12, 31)
            ))
        db.session.bulk_save_objects(meds)
        db.session.commit()
        app.logger.info(f'Seeded {len(meds)} medicines')

    if LabTest.query.count() == 0:
        tests_data = [
            ('WBC', '白细胞计数', 'blood', '血常规', '10^9/L', 6.0, 17.0, None, 50),
            ('RBC', '红细胞计数', 'blood', '血常规', '10^12/L', 5.5, 8.5, None, 40),
            ('HGB', '血红蛋白', 'blood', '血常规', 'g/L', 120, 180, None, 35),
            ('HCT', '红细胞压积', 'blood', '血常规', '%', 37, 55, None, 30),
            ('PLT', '血小板计数', 'blood', '血常规', '10^9/L', 200, 500, None, 45),
            ('LYM%', '淋巴细胞百分比', 'blood', '血常规', '%', 12, 30, None, 25),
            ('NEU%', '中性粒细胞百分比', 'blood', '血常规', '%', 60, 77, None, 25),
            ('ALT', '谷丙转氨酶', 'blood', '生化', 'U/L', 10, 125, None, 60),
            ('AST', '谷草转氨酶', 'blood', '生化', 'U/L', 10, 50, None, 60),
            ('ALP', '碱性磷酸酶', 'blood', '生化', 'U/L', 23, 212, None, 55),
            ('TP', '总蛋白', 'blood', '生化', 'g/L', 52, 82, None, 50),
            ('ALB', '白蛋白', 'blood', '生化', 'g/L', 27, 40, None, 45),
            ('GLU', '血糖', 'blood', '生化', 'mmol/L', 3.9, 8.3, None, 40),
            ('BUN', '尿素氮', 'blood', '生化', 'mmol/L', 2.5, 9.6, None, 50),
            ('CREA', '肌酐', 'blood', '生化', 'umol/L', 44, 159, None, 55),
            ('TBIL', '总胆红素', 'blood', '生化', 'umol/L', 2, 15, None, 45),
            ('PH', '尿液pH值', 'urine', '尿常规', '', 5.5, 7.5, None, 15),
            ('PRO', '尿蛋白', 'urine', '尿常规', '', None, None, '阴性', 15),
            ('GLU-U', '尿糖', 'urine', '尿常规', '', None, None, '阴性', 15),
            ('XRAY-CHEST', '胸部X光', 'imaging', 'X光', None, None, None, '正侧位', 300, False, True),
            ('XRAY-ABDOMEN', '腹部X光', 'imaging', 'X光', None, None, None, '正侧位', 320, False, True),
            ('B-LIVER', '肝脏B超', 'imaging', 'B超', None, None, None, '肝胆胰脾', 280, False, True),
            ('B-KIDNEY', '肾脏B超', 'imaging', 'B超', None, None, None, '双肾膀胱', 260, False, True),
            ('B-HEART', '心脏超声', 'imaging', 'B超', None, None, None, '心脏彩超', 500, False, True),
            ('FNA', '细针抽吸', 'pathology', '病理', '', None, None, '细胞病理学', 150, True, True),
            ('BIOPSY', '组织活检', 'pathology', '病理', '', None, None, '组织病理学', 600, True, True),
        ]
        tests = []
        for data in tests_data:
            t = LabTest(
                code=data[0], name=data[1], category=data[2], subcategory=data[3],
                unit=data[4], reference_min=data[5], reference_max=data[6], reference_text=data[7],
                price=data[8], is_active=True, need_attachment=data[9] if len(data) > 9 else False
            )
            tests.append(t)
        db.session.bulk_save_objects(tests)
        db.session.commit()
        app.logger.info(f'Seeded {len(tests)} lab tests')

    if Owner.query.count() == 0:
        import random
        random.seed(2024)
        first_names_o = ['张', '李', '王', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗']
        last_names_o = ['先生', '女士', '哥', '姐', '']
        owners = []
        for i in range(500):
            fn = random.choice(first_names_o)
            owners.append(Owner(
                name=f'{fn}{random.choice(["先生", "女士", random.choice(["小明", "丽", "强", "芳", "军", "娜", "静", "伟", "敏", "磊"])])}',
                phone=f'1{"35" if i % 2 == 0 else "39"}{random.randint(10000000, 99999999)}',
                id_card=f'1101{random.randint(100000000000, 999999999999):012d}' if random.random() < 0.3 else None,
                address=f'北京市{random.choice(["朝阳区", "海淀区", "西城区", "东城区", "丰台区", "通州区"])}{random.choice(["和平路", "朝阳路", "中关村", "建国门外", "西大望路"])}{random.randint(1, 999)}号院{random.randint(1, 20)}号楼{random.randint(1, 3000)}室'
            ))
        db.session.bulk_save_objects(owners)
        db.session.commit()
        app.logger.info(f'Seeded {len(owners)} owners')

        if Pet.query.count() == 0:
            species_breeds = {
                '犬': ['金毛寻回', '拉布拉多', '柯基', '泰迪', '比熊', '哈士奇', '边牧', '萨摩耶', '博美', '柴犬', '法斗', '英斗', '德牧', '阿拉斯加', '雪纳瑞'],
                '猫': ['中华田园', '英短', '美短', '布偶', '暹罗', '波斯', '缅因', '加菲', '折耳', '无毛猫']
            }
            pet_names = ['豆豆', '毛毛', '小白', '小黑', '小黄', '旺财', '来福', '雪球', '可乐', '咖啡', '奶茶', '布丁', '巧克力', '糖糖', '多多', '嘟嘟', '点点', '球球', '贝贝', '花花', '乐乐', '欢欢', '甜甜', '美美', '奇奇']
            pets = []
            for owner in owners:
                pet_count = random.choice([1, 1, 1, 2, 2, 3])
                for _ in range(pet_count):
                    species = random.choice(list(species_breeds.keys()))
                    breed = random.choice(species_breeds[species])
                    import datetime as dt
                    birth = dt.date(2020, 1, 1) + timedelta(days=random.randint(0, 365 * 6))
                    pets.append(Pet(
                        owner_id=owner.id,
                        name=random.choice(pet_names),
                        species=species,
                        breed=breed,
                        gender=random.choice(['male', 'female', 'unknown']),
                        birth_date=birth,
                        weight=round(random.uniform(2, 40) if species == '犬' else random.uniform(2, 8), 1),
                        color=random.choice(['白色', '黑色', '黄色', '棕色', '灰色', '花色', '橘色', '奶牛色']),
                        microchip_id=f'900{random.randint(100000000000, 999999999999):012d}' if random.random() < 0.4 else None,
                        is_neutered=random.random() < 0.6,
                        allergy_history=random.choice([None, None, None, '青霉素过敏', '海鲜过敏', '牛肉过敏'])
                    ))
            db.session.bulk_save_objects(pets)
            db.session.commit()
            app.logger.info(f'Seeded {len(pets)} pets')


app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
