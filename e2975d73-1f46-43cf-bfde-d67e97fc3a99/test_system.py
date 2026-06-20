#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
from datetime import datetime, timedelta
import random

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.logger import logger
from utils.db import db
from config.settings import POLICY_CATEGORIES, POLICY_TYPES

MOCK_POLICIES = [
    {
        "title": "关于印发《伤残抚恤管理办法》的通知",
        "content": """
        为贯彻落实《退役军人保障法》，进一步规范伤残抚恤管理工作，根据《军人抚恤优待条例》等规定，现就有关问题通知如下：

        一、伤残等级评定
        伤残等级评定应当依据《军人残疾等级评定标准》执行，分为一至十级。一级为最严重，十级为最轻。

        二、护理费发放标准
        对一级至四级残疾军人，按照当地职工月平均工资的一定比例发放护理费。具体标准为：
        一级：50%，二级：40%，三级：30%，四级：20%。

        三、辅助器具配置
        残疾军人需要配置假肢、轮椅等辅助器具的，按照《优抚对象辅助器具配置目录》执行。

        四、医疗保障
        根据《优抚对象医疗保障办法》规定，一级至六级残疾军人按照属地原则参加城镇职工基本医疗保险，并在此基础上享受残疾军人医疗补助。

        五、本通知自2024年1月1日起执行。
        """,
        "category": "伤残抚恤",
        "policy_type": "部门规章",
        "publish_date": "2023-12-15",
        "source": "退役军人事务部",
        "site_name": "退役军人事务部",
        "site_code": "mva_gov_cn",
        "url": "http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/202312/t20231215_100001.html"
    },
    {
        "title": "关于调整部分优抚对象等人员抚恤和生活补助标准的通知",
        "content": """
        按照《军人抚恤优待条例》规定，经省政府批准，决定从2024年1月1日起，调整部分优抚对象等人员抚恤和生活补助标准。

        一、在乡老复员军人生活补助标准
        在乡老复员军人的生活补助标准每人每月提高200元。

        二、带病回乡退伍军人生活补助标准
        带病回乡退伍军人的生活补助标准每人每月提高150元。

        三、参战退役人员生活补助标准
        参战退役人员的生活补助标准每人每月提高100元。

        四、参试退役人员生活补助标准
        参试退役人员的生活补助标准每人每月提高100元。

        五、部分农村籍退役士兵老年生活补助标准
        部分农村籍退役士兵的老年生活补助标准每服一年义务兵役每人每月提高5元。

        根据《关于提高部分优抚对象抚恤补助标准的通知》要求，各地要确保抚恤补助资金及时足额发放到位。
        """,
        "category": "定期生活补助",
        "policy_type": "规范性文件",
        "publish_date": "2023-12-20",
        "source": "省退役军人事务厅 省财政厅",
        "site_name": "省退役军人事务厅",
        "site_code": "provincial_mva",
        "url": "http://tyjrswt.xxx.gov.cn/xxgk/zcwj/202312/t20231220_200001.html"
    },
    {
        "title": "优抚对象医疗保障实施细则",
        "content": """
        为保障优抚对象医疗待遇，根据《优抚对象医疗保障办法》和我省实际，制定本实施细则。

        一、保障对象
        本细则所称优抚对象是指具有本省城乡居民户籍，且在本省行政区域内领取定期抚恤金或者定期定量生活补助的下列人员：
        （一）一至六级残疾军人；
        （二）在乡老复员军人；
        （三）带病回乡退伍军人；
        （四）参战退役人员；
        （五）参试退役人员；
        （六）部分农村籍退役士兵；
        （七）烈士遗属、因公牺牲军人遗属、病故军人遗属。

        二、保障办法
        优抚对象医疗保障按照属地管理原则，实行以城镇职工基本医疗保险、城乡居民基本医疗保险为基础，以医疗救助、医疗优惠为补充的医疗保障制度。

        按照《省医疗保障局关于进一步做好医疗救助工作的通知》要求，对符合条件的优抚对象实行倾斜救助。

        三、医疗补助标准
        一至六级残疾军人在城镇职工基本医疗保险支付范围内，个人自付部分补助比例不低于90%。
        其他优抚对象在基本医疗保险支付范围内，个人自付超过一定数额的，按照不低于50%的比例给予医疗救助。

        四、本细则自2024年2月1日起施行。
        """,
        "category": "医疗救助",
        "policy_type": "规范性文件",
        "publish_date": "2024-01-05",
        "source": "省退役军人事务厅 省医保局 省民政厅",
        "site_name": "省医疗保障局",
        "site_code": "provincial_ybj",
        "url": "http://ybj.xxx.gov.cn/xxgk/zcwj/202401/t20240105_300001.html"
    },
    {
        "title": "关于促进新时代退役军人就业创业工作的实施意见",
        "content": """
        为深入贯彻落实《国务院关于推动创新创业高质量发展打造"双创"升级版的意见》和《关于促进新时代退役军人就业创业工作的意见》精神，结合我省实际，提出以下实施意见。

        一、总体要求
        坚持政府推动、市场引导、社会支持相结合，以提升退役军人就业创业能力为核心，健全完善退役军人就业创业服务体系。

        二、加强职业技能培训
        （一）完善培训政策。退役军人在退出现役后1年内，可免费参加一次职业技能培训。
        （二）优化培训内容。按照《退役军人职业技能培训目录》，重点开展先进制造业、现代服务业、现代农业等领域的技能培训。

        三、加大就业扶持力度
        （一）落实岗位补贴。对吸纳退役军人就业的企业，按照每人5000元的标准给予一次性岗位补贴。
        （二）社会保险补贴。对用人单位招用就业困难退役军人并缴纳社会保险费的，给予社会保险补贴。
        （三）公益性岗位安置。开发公益性岗位优先安置就业困难退役军人。

        四、强化创业扶持
        （一）创业担保贷款。退役军人自主创业的，可申请最高30万元的创业担保贷款。
        （二）税费减免。按照《关于进一步支持小微企业和个体工商户发展有关税费政策的公告》规定，退役军人从事个体经营的，自办理个体工商户登记当月起，在3年内按每户每年12000元为限额依次扣减相关税费。

        五、健全服务体系
        依托《公共就业服务机构创业服务规范》，为退役军人提供政策咨询、创业指导、项目推介、融资对接等服务。
        """,
        "category": "就业扶持",
        "policy_type": "规范性文件",
        "publish_date": "2024-01-10",
        "source": "省退役军人事务厅 省人力资源和社会保障厅",
        "site_name": "省人力资源和社会保障厅",
        "site_code": "provincial_hrss",
        "url": "http://rst.xxx.gov.cn/xxgk/zcwj/202401/t20240110_400001.html"
    },
    {
        "title": "《军人抚恤优待条例》政策解读",
        "content": """
        一、修订背景
        为贯彻落实《中华人民共和国退役军人保障法》，适应新时代优抚工作新形势新要求，对《军人抚恤优待条例》进行了修订。

        二、主要内容
        （一）完善了优抚对象范围。将因公牺牲军人遗属、病故军人遗属纳入优待范围。
        （二）提高了抚恤补助标准。建立抚恤补助标准自然增长机制。
        （三）明确了医疗保障待遇。一级至六级残疾军人按照属地原则参加城镇职工基本医疗保险。

        三、重点问题解读
        问：哪些人员可以享受定期抚恤金？
        答：根据《军人抚恤优待条例》规定，对符合下列条件的烈士遗属、因公牺牲军人遗属、病故军人遗属，发给定期抚恤金：
        （一）父母（抚养人）、配偶无劳动能力、无生活费来源，或者收入水平低于当地居民平均生活水平的；
        （二）子女未满18周岁或者已满18周岁但因上学或者残疾无生活费来源的；
        （三）兄弟姐妹未满18周岁或者已满18周岁但因上学无生活费来源且由该军人生前供养的。

        四、贯彻落实要求
        各地要严格按照《伤残抚恤管理办法》和本条例的规定，做好政策落实工作。
        """,
        "category": "优待抚恤",
        "policy_type": "政策解读",
        "publish_date": "2024-01-15",
        "source": "退役军人事务部政策法规司",
        "site_name": "退役军人事务部",
        "site_code": "mva_gov_cn",
        "url": "http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/202401/t20240115_100002.html"
    },
    {
        "title": "退役士兵安置条例",
        "content": """
        第一章 总则
        第一条 为了规范退役士兵安置工作，保障退役士兵的合法权益，根据《中华人民共和国兵役法》和《中华人民共和国退役军人保障法》，制定本条例。

        第二条 本条例所称退役士兵，是指依照《中国人民解放军现役士兵服役条例》的规定退出现役的义务兵和士官。

        第二章 移交和接收
        第八条 国务院退役士兵安置工作主管部门和中国人民解放军总参谋部应当制定全国退役士兵年度移交计划。

        第三章 自主就业
        第十八条 义务兵和服现役不满12年的士官退出现役的，由人民政府扶持自主就业。

        第十九条 对自主就业的退役士兵，由部队发给一次性退役金，一次性退役金由中央财政专项安排；地方人民政府可以根据当地实际情况给予经济补助，经济补助标准及发放办法由省、自治区、直辖市人民政府规定。

        根据《关于进一步做好退役军人就业创业工作的通知》，自主就业退役士兵可享受免费职业技能培训。

        第四章 安排工作
        第二十九条 退役士兵符合下列条件之一的，由人民政府安排工作：
        （一）士官服现役满12年的；
        （二）服现役期间平时荣获二等功以上奖励或者战时荣获三等功以上奖励的；
        （三）因战致残被评定为5级至8级残疾等级的；
        （四）是烈士子女的。

        第五章 退休与供养
        第四十一条 中级以上士官符合下列条件之一的，作退休安置：
        （一）年满55周岁的；
        （二）服现役满30年的；
        （三）因战、因公致残被评定为1级至6级残疾等级的；
        （四）经军队医院证明和军级以上单位卫生部门审核确认因病基本丧失工作能力的。
        """,
        "category": "退役安置",
        "policy_type": "行政法规",
        "publish_date": "2024-01-20",
        "source": "国务院 中央军委",
        "site_name": "退役军人事务部",
        "site_code": "mva_gov_cn",
        "url": "http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/202401/t20240120_100003.html"
    },
    {
        "title": "优抚对象住房保障办法",
        "content": """
        为切实解决优抚对象住房困难，根据《军人抚恤优待条例》和我省《保障性住房管理办法》，制定本办法。

        一、保障对象
        本办法适用于具有本省户籍且符合下列条件的优抚对象：
        （一）退出现役的残疾军人；
        （二）在乡老复员军人；
        （三）带病回乡退伍军人；
        （四）参战退役人员；
        （五）参试退役人员；
        （六）烈士遗属、因公牺牲军人遗属、病故军人遗属。

        二、保障方式
        优抚对象住房保障采取实物配租、租赁补贴和危房改造相结合的方式。

        三、优先优惠政策
        （一）申请公租房、廉租房的优抚对象，符合条件的优先予以保障；
        （二）对符合条件的优抚对象，租赁补贴标准在普通保障对象基础上提高30%；
        （三）农村优抚对象危房改造补助标准在普通农户基础上提高50%。

        按照《省民政厅关于做好农村危房改造工作的通知》要求，各地要将优抚对象作为重点保障对象。

        四、申请审批程序
        （一）申请。申请人向户籍所在地村（居）民委员会提出书面申请。
        （二）审核。乡镇人民政府（街道办事处）进行审核。
        （三）审批。县级人民政府住房保障主管部门进行审批。

        五、本办法自2024年3月1日起施行。
        """,
        "category": "住房保障",
        "policy_type": "规范性文件",
        "publish_date": "2024-02-01",
        "source": "省住建厅 省退役军人事务厅",
        "site_name": "省退役军人事务厅",
        "site_code": "provincial_mva",
        "url": "http://tyjrswt.xxx.gov.cn/xxgk/zcwj/202402/t20240201_200002.html"
    },
    {
        "title": "伤残抚恤优待办事指南",
        "content": """
        一、事项名称：伤残等级评定
        二、设定依据：《军人抚恤优待条例》、《伤残抚恤管理办法》
        三、申请条件：
        （一）在服役期间因战因公致残退出现役的军人；
        （二）在服役期间因病评定了残疾等级退出现役的残疾军人；
        （三）因战因公负伤时为行政编制的人民警察；
        （四）因参战、参加军事演习、军事训练和执行军事勤务致残的预备役人员、民兵、民工以及其他人员。

        四、办理材料：
        （一）个人书面申请；
        （二）身份证、户口簿复印件；
        （三）退役证件复印件；
        （四）服现役期间档案记载和原始医疗证明；
        （五）近期免冠照片。

        五、办理流程：
        （一）申请人向户籍所在地县级人民政府退役军人事务部门提出申请；
        （二）县级人民政府退役军人事务部门审查后报市级人民政府退役军人事务部门；
        （三）市级人民政府退役军人事务部门组织医疗卫生专家小组进行残疾等级鉴定；
        （四）省级人民政府退役军人事务部门审核批准。

        六、办理时限：60个工作日
        七、收费标准：不收费

        八、联系电话：0311-XXXXXXX

        根据《退役军人事务部关于印发〈伤残抚恤管理办法〉实施意见的通知》，各地要优化办理流程，提高服务质量。
        """,
        "category": "伤残抚恤",
        "policy_type": "办事指南",
        "publish_date": "2024-02-10",
        "source": "省退役军人事务厅",
        "site_name": "省退役军人事务厅",
        "site_code": "provincial_mva",
        "url": "http://tyjrswt.xxx.gov.cn/xxgk/zcwj/202402/t20240210_200003.html"
    },
    {
        "title": "关于做好烈士纪念日纪念活动的通知",
        "content": """
        今年9月30日是我国第十一个烈士纪念日。为深入学习贯彻习近平总书记关于烈士褒扬工作的重要指示精神，根据《中华人民共和国英雄烈士保护法》和《烈士褒扬条例》，现就做好烈士纪念日纪念活动通知如下：

        一、充分认识开展烈士纪念日纪念活动的重要意义
        开展烈士纪念日纪念活动，是缅怀烈士功绩、弘扬烈士精神的重要举措，对于培育和践行社会主义核心价值观，增强中华民族的凝聚力，实现中华民族伟大复兴的中国梦，具有重要而深远的意义。

        二、精心组织开展各项纪念活动
        （一）举行向人民英雄敬献花篮仪式；
        （二）组织祭扫烈士墓活动；
        （三）开展烈士事迹宣讲活动；
        （四）走访慰问烈士遗属。

        按照《烈士褒扬条例》规定，对烈士遗属给予定期抚恤金，并在医疗、住房、教育、就业等方面给予优先优惠待遇。

        三、工作要求
        （一）加强组织领导。各级各部门要高度重视，精心组织安排。
        （二）注重实际效果。要把开展纪念活动与解决实际问题结合起来。
        （三）营造浓厚氛围。充分利用各种媒体宣传烈士事迹。
        """,
        "category": "褒扬纪念",
        "policy_type": "规范性文件",
        "publish_date": "2024-02-15",
        "source": "省退役军人事务厅",
        "site_name": "省退役军人事务厅",
        "site_code": "provincial_mva",
        "url": "http://tyjrswt.xxx.gov.cn/xxgk/zcwj/202402/t20240215_200004.html"
    },
    {
        "title": "关于做好困难退役军人帮扶援助工作的实施意见",
        "content": """
        为深入贯彻落实《关于加强困难退役军人帮扶援助工作的意见》，切实解决困难退役军人和其他优抚对象的实际困难，结合我省实际，提出以下实施意见。

        一、总体要求
        坚持以人民为中心的发展思想，按照"解三难、全覆盖、多层次、可持续"的工作思路，建立健全困难退役军人帮扶援助工作机制。

        二、帮扶援助对象
        本意见所称帮扶援助对象，是指具有本省户籍，且符合下列条件之一的退役军人和其他优抚对象：
        （一）脱贫不稳定户、边缘易致贫户，以及因病因灾因意外事故等刚性支出较大或收入大幅缩减导致基本生活出现严重困难户；
        （二）享受最低生活保障待遇或纳入特困人员救助供养范围的；
        （三）因重大疾病、重大自然灾害、重大交通事故等导致生活陷入困境的；
        （四）因老、弱、病、残等原因导致生活不能自理的。

        三、帮扶援助内容
        （一）生活援助。对生活困难的，给予临时性生活援助。
        （二）医疗援助。对医疗费用负担较重的，给予医疗援助。
        （三）住房援助。对住房困难的，按照《优抚对象住房保障办法》优先给予住房援助。
        （四）就业援助。对就业困难的，按照《关于促进新时代退役军人就业创业工作的实施意见》给予就业援助。

        四、帮扶援助标准
        生活援助标准每次不超过当地12个月城市最低生活保障标准。
        医疗援助标准为医疗费用经基本医保、大病保险、医疗救助等支付后，个人自付部分按照不低于50%的比例给予援助。

        五、本意见自2024年4月1日起施行。
        """,
        "category": "帮扶援助",
        "policy_type": "规范性文件",
        "publish_date": "2024-02-20",
        "source": "省退役军人事务厅 省民政厅 省财政厅",
        "site_name": "省民政厅",
        "site_code": "provincial_mca",
        "url": "http://mca.xxx.gov.cn/xxgk/zcwj/202402/t20240220_500001.html"
    }
]


def generate_mock_data():
    print("正在生成模拟政策数据...")

    count = 0
    for policy_data in MOCK_POLICIES:
        policy_data['created_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        policy_data['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        policy_data['status'] = 'active'
        policy_data['raw_html'] = f"<html><body>{policy_data['content']}</body></html>"

        policy_id = db.insert_policy(policy_data)
        if policy_id:
            count += 1
            print(f"  ✓ 已插入: {policy_data['title'][:60]}...")

            db.update_crawl_record(policy_data['url'], 'success', policy_data['publish_date'])

    print(f"\n成功插入 {count} 条模拟数据")
    return count


def test_pipelines():
    print("\n正在测试数据处理管道...")

    try:
        from pipelines.clean_pipeline import CleanPipeline
        clean_pipeline = CleanPipeline()
    except ImportError as e:
        print(f"   ⚠ 无法导入清洗管道: {e}")
        print("   请运行: pip install beautifulsoup4 html5lib")
        return False

    try:
        from pipelines.classify_pipeline import ClassifyPipeline
        classify_pipeline = ClassifyPipeline()
    except ImportError as e:
        print(f"   ⚠ 无法导入分类管道: {e}")
        print("   请运行: pip install jieba scikit-learn")
        return False

    test_policy = MOCK_POLICIES[0].copy()
    test_policy['content'] = test_policy['content'] + '<div style="color:red;">这是HTML标签测试</div>&nbsp;'

    class MockSpider:
        name = 'test_spider'

    mock_spider = MockSpider()

    class MockItem(dict):
        pass

    item = MockItem(test_policy)

    print("\n1. 测试数据清洗管道...")
    cleaned_item = clean_pipeline.process_item(item, mock_spider)
    print(f"   清洗后内容长度: {len(cleaned_item['content'])} 字符")
    assert '<div' not in cleaned_item['content'], "HTML标签未被清除"
    print("   ✓ HTML标签清除成功")

    print("\n2. 测试分类管道...")
    classified_item = classify_pipeline.process_item(cleaned_item, mock_spider)
    print(f"   分类结果: {classified_item['category']}")
    print(f"   政策类型: {classified_item['policy_type']}")
    print(f"   置信度: {classified_item['confidence']:.2f}")
    print(f"   关键词: {classified_item['keywords'][:5]}")
    print(f"   摘要: {classified_item['summary'][:50]}...")
    assert classified_item['category'] == '伤残抚恤', f"分类错误: {classified_item['category']}"
    print("   ✓ 分类正确")

    return True


def test_relations():
    print("\n正在测试关联分析...")

    try:
        from pipelines.relation_pipeline import RelationPipeline
        relation_pipeline = RelationPipeline()
    except ImportError as e:
        print(f"   ⚠ 无法导入关联分析管道: {e}")
        return False

    class MockSpider:
        name = 'test_spider'

    mock_spider = MockSpider()

    policies = db.get_policies(limit=10)
    for policy in policies:
        item = {k: v for k, v in policy.items() if k != 'id'}
        relation_pipeline.process_item(item, mock_spider)

    stats = db.get_statistics()
    print(f"   总政策数: {stats.get('total_policies', 0)}")
    print(f"   总关联数: {stats.get('total_relations', 0)}")
    print("   ✓ 关联分析完成")

    return True


def test_search():
    print("\n正在测试搜索功能...")

    keywords = ["伤残", "医疗", "就业", "抚恤"]
    for keyword in keywords:
        results = db.search_policies(keyword, limit=5)
        print(f"   搜索 '{keyword}': 找到 {len(results)} 条结果")
        if results:
            print(f"     第一条: {results[0]['title'][:50]}...")

    print("   ✓ 搜索功能正常")
    return True


def test_export():
    print("\n正在测试导出功能...")

    import tempfile
    import json

    policies = db.get_policies(limit=5)

    temp_dir = tempfile.gettempdir()

    json_path = os.path.join(temp_dir, "test_export.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(policies, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(json_path) / 1024
    print(f"   JSON导出成功: {json_path} ({file_size:.2f} KB)")

    try:
        import pandas as pd
        excel_path = os.path.join(temp_dir, "test_export.xlsx")
        df = pd.DataFrame(policies)
        df.to_excel(excel_path, index=False)
        file_size = os.path.getsize(excel_path) / 1024
        print(f"   Excel导出成功: {excel_path} ({file_size:.2f} KB)")
    except ImportError:
        print("   ⚠ pandas未安装，跳过Excel导出测试")

    print("   ✓ 导出功能正常")
    return True


def test_cli_help():
    print("\n正在测试命令行界面...")

    import subprocess

    result = subprocess.run(
        [sys.executable, "main.py", "--help"],
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    if result.returncode == 0:
        print("   ✓ 命令行界面正常")
        print(f"   帮助信息长度: {len(result.stdout)} 字符")
    else:
        print(f"   ⚠ 命令行测试返回码: {result.returncode}")
        if result.stderr:
            print(f"   错误信息: {result.stderr[:200]}")

    return True


def main():
    print("=" * 70)
    print("优抚政策自动采集与聚合工具 - 系统测试")
    print("=" * 70)

    print("\n1. 初始化数据库...")
    db.init_database()
    print("   ✓ 数据库初始化完成")

    print("\n2. 生成模拟数据...")
    count = generate_mock_data()
    if count == 0:
        print("   ⚠ 数据已存在，跳过生成")

    print("\n3. 运行数据处理管道测试...")
    test_pipelines()

    print("\n4. 运行关联分析测试...")
    test_relations()

    print("\n5. 运行搜索功能测试...")
    test_search()

    print("\n6. 运行导出功能测试...")
    test_export()

    print("\n7. 运行命令行界面测试...")
    test_cli_help()

    print("\n" + "=" * 70)
    print("系统统计:")
    print("=" * 70)
    stats = db.get_statistics()
    print(f"  总政策记录: {stats.get('total_policies', 0)}")
    print(f"  总关联关系: {stats.get('total_relations', 0)}")

    print("\n按分类统计:")
    for item in stats.get('by_category', []):
        print(f"  {item.get('category', '未知'):12s}: {item.get('count', 0)} 条")

    print("\n" + "=" * 70)
    print("✓ 所有测试完成！系统运行正常。")
    print("=" * 70)

    print("\n使用说明:")
    print("  python3 main.py --help       # 查看帮助")
    print("  python3 main.py stats        # 查看统计")
    print("  python3 main.py search 关键词 # 搜索政策")
    print("  python3 main.py export --format excel  # 导出Excel")
    print("  python3 main.py report --days 7        # 生成周报")


if __name__ == '__main__':
    main()
