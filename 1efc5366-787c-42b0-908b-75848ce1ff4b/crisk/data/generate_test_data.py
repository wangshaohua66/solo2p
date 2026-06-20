import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import random

random.seed(42)
np.random.seed(42)


def generate_declarations(output_path: Path, num_records: int = 1000):
    companies = [
        "深圳某电子科技有限公司", "广州某贸易有限公司", "上海某进出口有限公司",
        "宁波某物流有限公司", "青岛某国际贸易公司", "天津某货运代理有限公司",
        "厦门某商贸有限公司", "苏州某电子有限公司", "杭州某科技有限公司",
        "南京某进出口贸易公司"
    ]

    consignees = [
        "深圳某电子科技有限公司", "广州市某贸易商行", "上海某科技发展有限公司",
        "宁波保税区某公司", "青岛某制造有限公司", "天津某物流仓储公司",
        "厦门某电商有限公司", "苏州某工厂", "杭州某零售有限公司",
        "南京某供应链管理公司"
    ]

    hs_codes = [
        ("85171200", "智能手机", 3000, 6000),
        ("84713000", "笔记本电脑", 5000, 12000),
        ("84714100", "台式计算机", 3000, 8000),
        ("85258013", "数码相机", 2000, 8000),
        ("27101921", "车用汽油", 5000, 8000),
        ("22089020", "威士忌酒", 200, 500),
        ("24022000", "卷烟", 10, 50),
        ("71023900", "钻石首饰", 5000, 50000),
        ("87032341", "小轿车", 150000, 500000),
        ("30049090", "药品制剂", 100, 1000),
        ("85287221", "液晶电视机", 2000, 8000),
        ("85176299", "通信设备零件", 50, 500),
    ]

    origins = ["日本", "韩国", "美国", "德国", "中国香港", "中国台湾", "新加坡", "马来西亚", "泰国", "越南"]
    destinations = ["中国"]
    transports = ["海运", "空运", "陆运", "铁路"]

    base_date = datetime(2025, 1, 1)

    data = []
    for i in range(num_records):
        hs_code, product_name, min_price, max_price = random.choice(hs_codes)
        declare_date = base_date + timedelta(days=random.randint(0, 179))

        price = random.uniform(min_price, max_price)
        quantity = random.randint(1, 100)

        if random.random() < 0.05:
            price = price * random.uniform(0.3, 0.6)

        if random.random() < 0.03:
            fake_products = ["电子配件", "五金零件", "塑料制品", "文具用品", "日用百货"]
            product_name = random.choice(fake_products)

        company = random.choice(companies)
        consignee = random.choice(consignees)

        if random.random() < 0.04:
            consignee = "深圳某电子科技有限公司"
            hs_code = "85171200"
            product_name = "智能手机"
            price = 4000
            quantity = 10

        origin = random.choice(origins)
        destination = random.choice(destinations)
        transport = random.choice(transports)

        if random.random() < 0.02:
            origin = random.choice(["冰岛", "卢森堡", "巴拿马", "塞浦路斯"])
            transport = "空运"

        data.append({
            "报关单号": f"BG{declare_date.strftime('%Y%m%d')}{i:06d}",
            "品名": product_name,
            "HS编码": hs_code,
            "申报货值": round(price * quantity, 2),
            "数量": quantity,
            "原产地": origin,
            "目的地": destination,
            "经营单位": company,
            "运输方式": transport,
            "申报日期": declare_date.strftime("%Y-%m-%d"),
            "收货人": consignee,
        })

    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成 {len(df)} 条报关单测试数据: {output_path}")
    return df


def generate_cases(output_path: Path, num_cases: int = 50):
    case_types = ["低报货值", "品名伪报", "拆单逃证", "通道异常", "综合走私"]
    companies = [
        "深圳某电子科技有限公司", "广州某贸易有限公司", "上海某进出口有限公司",
        "宁波某物流有限公司", "青岛某国际贸易公司", "天津某货运代理有限公司",
    ]
    hs_codes = ["85171200", "84713000", "85258013", "27101921", "22089020", "24022000", "71023900", "87032341"]
    origins = ["日本", "韩国", "美国", "德国", "中国香港", "新加坡"]
    verdicts = ["已起诉", "已判决", "行政处罚", "不起诉"]

    base_date = datetime(2022, 1, 1)

    data = []
    for i in range(num_cases):
        case_date = base_date + timedelta(days=random.randint(0, 1095))
        data.append({
            "案件编号": f"AJ{case_date.strftime('%Y')}{i:05d}",
            "案件日期": case_date.strftime("%Y-%m-%d"),
            "案件类型": random.choice(case_types),
            "HS编码": random.choice(hs_codes),
            "经营单位": random.choice(companies),
            "原产地": random.choice(origins),
            "收货人": random.choice(companies),
            "涉案金额": round(random.uniform(50000, 5000000), 2),
            "案件摘要": f"涉嫌{random.choice(case_types)}走私，案值约{random.randint(100, 5000)}万元",
            "判决结果": random.choice(verdicts),
        })

    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成 {len(df)} 条历史案件测试数据: {output_path}")
    return df


def generate_risk_controls(output_path: Path, num_controls: int = 100):
    risk_levels = ["高", "中", "低"]
    control_types = ["重点查验", "风险提示", "后续稽查"]
    hs_codes = ["851712", "847130", "852580", "271019", "220890", "240220", "710239", "870323"]

    data = []
    for i in range(num_controls):
        data.append({
            "布控单号": f"BK{datetime.now().strftime('%Y%m%d')}{i:04d}",
            "HS编码": random.choice(hs_codes),
            "经营单位": "",
            "原产地": "",
            "风险等级": random.choice(risk_levels),
            "布控类型": random.choice(control_types),
            "生效日期": (datetime.now() - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d"),
            "失效日期": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
            "描述": f"重点关注{random.choice(['低报货值', '品名伪报', '拆单逃证'])}风险",
        })

    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成 {len(df)} 条风险布控测试数据: {output_path}")
    return df


def generate_inspections(output_path: Path, num_inspections: int = 200):
    results = ["正常", "异常", "违规", "待复查"]
    findings = ["", "单货不符", "申报不实", "归类错误", "价格疑问", "数量不符"]

    data = []
    for i in range(num_inspections):
        result = random.choice(results)
        finding = random.choice(findings) if result != "正常" else ""
        data.append({
            "查验单号": f"CY{datetime.now().strftime('%Y%m%d')}{i:05d}",
            "报关单号": f"BG2025{random.randint(1, 6):02d}{random.randint(1, 28):02d}{random.randint(1, 999999):06d}",
            "查验日期": (datetime.now() - timedelta(days=random.randint(0, 180))).strftime("%Y-%m-%d"),
            "查验结果": result,
            "查验发现": finding,
            "HS编码": "",
            "经营单位": "",
        })

    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    print(f"✅ 已生成 {len(df)} 条查验反馈测试数据: {output_path}")
    return df


if __name__ == "__main__":
    data_dir = Path(__file__).parent

    generate_declarations(data_dir / "test_declarations.csv", 2000)
    generate_cases(data_dir / "test_cases.csv", 50)
    generate_risk_controls(data_dir / "test_risk_controls.csv", 100)
    generate_inspections(data_dir / "test_inspections.csv", 200)

    print("\n🎉 所有测试数据生成完成！")
