"""端到端 dry-run 冒烟测试: 生成合成损伤图像并跑通全流程。"""
import os
import sys
import json
import numpy as np
import cv2

# 初始化日志
from logger import AppLogger
AppLogger.setup("config.yaml")

from image_analyzer import ImageAnalyzer
from damage_classifier import DamageClassifier
from case_processor import CaseProcessor

CASE_DIR = "./data/watch/SMOKE_TEST"
os.makedirs(CASE_DIR, exist_ok=True)


def make_synthetic_image(path):
    """生成一张带损伤特征的合成车辆照片 (纯色车身 + 划痕/凹陷纹理)。"""
    img = np.full((720, 1280, 3), 110, dtype=np.uint8)
    # 车身区域
    cv2.rectangle(img, (200, 200), (1080, 620), (80, 80, 90), -1)
    # 刮擦: 一条长高对比细线 (长宽比大)
    cv2.line(img, (350, 300), (700, 330), (240, 240, 240), 3)
    # 凹陷: 一个带阴影渐变的椭圆块
    overlay = img.copy()
    cv2.ellipse(overlay, (820, 450), (60, 45), 0, 0, 360, (40, 40, 40), -1)
    cv2.addWeighted(overlay, 0.6, img, 0.4, 0, img)
    # 破裂: 细长分叉线
    cv2.line(img, (500, 500), (560, 560), (250, 250, 250), 1)
    cv2.line(img, (560, 560), (600, 520), (250, 250, 250), 1)
    cv2.line(img, (560, 560), (610, 590), (250, 250, 250), 1)
    # 加噪声提升去噪/轮廓检测路径
    noise = np.random.normal(0, 8, img.shape).astype(np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    cv2.imwrite(path, img)


def main():
    img_path = os.path.join(CASE_DIR, "accident_01.jpg")
    make_synthetic_image(img_path)
    print(f"[smoke] 合成图像已生成: {img_path}")

    # 写案件元数据
    meta = {
        "license_plate": "京A12345",
        "vehicle_model": "测试车型X",
        "repair_shop": "测试修理厂",
        "accident_date": "2026-06-20",
        "accident_location": "测试路口",
    }
    with open(os.path.join(CASE_DIR, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # 1) 图像分析
    analyzer = ImageAnalyzer("config.yaml")
    results = analyzer.analyze_case(CASE_DIR, case_no="SMOKE_TEST")
    regions = analyzer.aggregate_damage(results)
    print(f"[smoke] 图像分析: 图片={len(results)} 损伤区域={len(regions)}")
    for r in regions:
        print(f"   - 部位={r.body_part} 面积占比={r.area_ratio:.3f} "
              f"特征keys={list(r.features.keys())}")

    # 2) 损伤分类
    classifier = DamageClassifier("config.yaml")
    cls = classifier.classify_all(regions, case_no="SMOKE_TEST")
    print(f"[smoke] 分类成功={cls.success} 损伤项={len(cls.items)} 合计={cls.grand_total}")
    for it in cls.items:
        print(f"   - {it.body_part_label} {it.damage_type_label} "
              f"{it.severity_label} 置信={it.confidence} 工时={it.labor_hours}h "
              f"费用={it.total_cost}")

    # 3) 录入字段
    fields = classifier.to_entry_fields(cls, "SMOKE_TEST")
    print(f"[smoke] 录入字段数={len(fields)}")
    # 合并元数据
    for k in ("license_plate", "vehicle_model", "repair_shop",
              "accident_date", "accident_location"):
        fields[k] = meta.get(k, "")
    print(f"[smoke] damage_part={fields['damage_part']} "
          f"total_cost={fields['total_cost']}")

    # 4) 全流程 dry-run
    processor = CaseProcessor("config.yaml", dry_run=True)
    result = processor.process_case(CASE_DIR, "SMOKE_TEST", meta)
    print(f"[smoke] 全流程结果 status={result.status} "
          f"image_ok={result.image_analysis_ok} "
          f"class_ok={result.classification_ok} entry_ok={result.entry_ok} "
          f"durations={result.durations}")
    print(f"[smoke] 结果文件: {result.result_path}")
    print("[smoke] SMOKE_TEST_DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
