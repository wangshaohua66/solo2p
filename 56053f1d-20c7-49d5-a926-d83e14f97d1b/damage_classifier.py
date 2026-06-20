"""
damage_classifier.py
================================================================================
损伤类型与程度分类模型

职责:
  1. 基于纹理/几何特征提取损伤区域特征 (复用 image_analyzer 已提取的特征)
  2. 损伤类型分类: 刮擦 / 凹陷 / 破裂 / 变形 (准确率目标 >= 85%)
  3. 损伤程度评估: 轻微 / 中度 / 重度, 输出维修工时估算
  4. 汇总输出损伤清单与费用估算, 供理赔系统录入

分类策略: 基于可配置阈值规则的特征匹配 (非深度学习, 依赖 OpenCV 特征),
         规则可经 config.yaml 调参, 后续可平滑替换为 ML 模型。
"""

from dataclasses import dataclass, field
from typing import List, Optional

import yaml

from image_analyzer import DamageRegion
from logger import get_logger

log = get_logger("damage_classifier")

# 损伤类型 -> 中文名称 (用于理赔系统录入)
TYPE_LABEL = {
    "scratch": "刮擦",
    "dent": "凹陷",
    "crack": "破裂",
    "deformation": "变形",
}

# 损伤程度 -> 中文名称
SEVERITY_LABEL = {
    "minor": "轻微",
    "moderate": "中度",
    "severe": "重度",
}


@dataclass
class DamageItem:
    """单条损伤清单记录。"""
    body_part: str                 # 车身部位 (英文 key)
    body_part_label: str           # 车身部位 (中文)
    damage_type: str               # 损伤类型 (英文 key)
    damage_type_label: str         # 损伤类型 (中文)
    severity: str                  # 损伤程度 (英文 key)
    severity_label: str            # 损伤程度 (中文)
    area_ratio: float              # 损伤面积占比
    confidence: float              # 分类置信度
    labor_hours: float             # 维修工时(小时)
    parts_cost: float              # 配件费用(元)
    labor_cost: float              # 工时费用(元)
    total_cost: float              # 单项合计(元)


@dataclass
class ClassificationResult:
    """案件损伤分类汇总结果。"""
    case_no: str = "-"
    items: List[DamageItem] = field(default_factory=list)
    total_labor_hours: float = 0.0
    total_parts_cost: float = 0.0
    total_labor_cost: float = 0.0
    grand_total: float = 0.0
    success: bool = False
    error: str = ""


class DamageClassifier:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path, "r", encoding="utf-8") as f:
            self.cfg = yaml.safe_load(f)
        self.type_cfg = self.cfg.get("damage_types", {})
        self.sev_cfg = self.cfg.get("damage_severity", {})
        self.confidence_margin = float(self.type_cfg.get("confidence_margin", 0.10))
        self.target_accuracy = float(self.type_cfg.get("target_accuracy", 0.85))
        # 部位中文映射
        self.part_label_map = {
            "front_bumper": "前保险杠", "rear_bumper": "后保险杠",
            "hood": "引擎盖", "trunk": "后备箱盖", "roof": "车顶",
            "front_door_left": "左前门", "rear_door_left": "左后门",
            "front_door_right": "右前门", "rear_door_right": "右后门",
            "fender_front_left": "左前翼子板",
            "fender_front_right": "右前翼子板",
            "headlight": "前大灯", "door": "车门", "unknown": "未知部位",
        }

    # --------------------------------------------------------------------------
    # 1. 损伤类型分类
    # --------------------------------------------------------------------------
    def classify_type(self, region: DamageRegion) -> tuple:
        """
        根据特征对单个损伤区域分类。
        返回 (damage_type, confidence)。
        """
        f = region.features
        scores = {}

        # 刮擦: 长条状(高长宽比) + 边缘密度高 + 颜色方差小
        scratch_cfg = self.type_cfg.get("scratch", {})
        ar = f.get("aspect_ratio", 1.0)
        ar_min = scratch_cfg.get("aspect_ratio_min", 3.0)
        ed = f.get("edge_density", 0.0)
        ed_min = scratch_cfg.get("edge_density_min", 0.25)
        cv_var = f.get("color_variance", 1.0)
        cv_max = scratch_cfg.get("color_variance_max", 0.15)
        scratch_score = self._score([
            (ar >= ar_min, 0.4),
            (ed >= ed_min, 0.3),
            (cv_var <= cv_max, 0.3),
        ])
        scores["scratch"] = scratch_score

        # 凹陷: 阴影梯度高 + 边缘密度中 + 长宽比小
        dent_cfg = self.type_cfg.get("dent", {})
        sg = f.get("shadow_gradient", 0.0)
        sg_min = dent_cfg.get("shadow_gradient_min", 0.35)
        ar_max = dent_cfg.get("aspect_ratio_max", 2.5)
        dent_score = self._score([
            (sg >= sg_min, 0.4),
            (ed >= dent_cfg.get("edge_density_min", 0.20), 0.2),
            (ar <= ar_max, 0.4),
        ])
        scores["dent"] = dent_score

        # 破裂: 分叉多 + 边缘锐利 + 宽度占比小
        crack_cfg = self.type_cfg.get("crack", {})
        bc = f.get("branch_count", 0)
        bc_min = crack_cfg.get("branch_count_min", 2)
        es = f.get("edge_sharpness", 0.0)
        es_min = crack_cfg.get("edge_sharpness_min", 0.45)
        wr = f.get("width_ratio", 1.0)
        wr_max = crack_cfg.get("width_ratio_max", 0.08)
        crack_score = self._score([
            (bc >= bc_min, 0.35),
            (es >= es_min, 0.35),
            (wr <= wr_max, 0.30),
        ])
        scores["crack"] = crack_score

        # 变形: 面积占比大 + 圆度低(不规则) + 实度低
        def_cfg = self.type_cfg.get("deformation", {})
        ar_ratio = region.area_ratio
        ar_ratio_min = def_cfg.get("area_ratio_min", 0.12)
        circ = f.get("circularity", 1.0)
        circ_max = def_cfg.get("circularity_max", 0.55)
        sol = f.get("solidity", 1.0)
        sol_max = def_cfg.get("solidity_max", 0.80)
        deformation_score = self._score([
            (ar_ratio >= ar_ratio_min, 0.35),
            (circ <= circ_max, 0.30),
            (sol <= sol_max, 0.35),
        ])
        scores["deformation"] = deformation_score

        # 选择置信度最高的类型
        best_type = max(scores, key=scores.get)
        best_score = scores[best_type]
        # 若最高分与次高分差距小于 confidence_margin, 标记为低置信度但保留最高
        sorted_scores = sorted(scores.values(), reverse=True)
        if len(sorted_scores) > 1 and \
                (sorted_scores[0] - sorted_scores[1]) < self.confidence_margin:
            best_score *= 0.85  # 降低置信度
        return best_type, round(best_score, 4)

    @staticmethod
    def _score(rules: list) -> float:
        """规则评分: 满足条件加权求和, 返回 0~1 置信度。"""
        total = 0.0
        for condition, weight in rules:
            if condition:
                total += weight
        return min(total, 1.0)

    # --------------------------------------------------------------------------
    # 2. 损伤程度评估
    # --------------------------------------------------------------------------
    def classify_severity(self, region: DamageRegion,
                          damage_type: str) -> tuple:
        """
        根据损伤面积占比评估程度, 返回 (severity, labor_hours)。
        """
        area_ratio = region.area_ratio
        minor = self.sev_cfg.get("minor", {})
        moderate = self.sev_cfg.get("moderate", {})
        severe = self.sev_cfg.get("severe", {})

        if area_ratio <= minor.get("area_ratio_max", 0.05):
            severity = "minor"
            base_hours = minor.get("labor_hours_base", 1.5)
            base_cost = minor.get("parts_cost_base", 200.0)
        elif area_ratio <= moderate.get("area_ratio_max", 0.20):
            severity = "moderate"
            base_hours = moderate.get("labor_hours_base", 4.0)
            base_cost = moderate.get("parts_cost_base", 800.0)
        else:
            severity = "severe"
            base_hours = severe.get("labor_hours_base", 8.0)
            base_cost = severe.get("parts_cost_base", 2500.0)

        # 工时随面积占比线性放大 (上限 2 倍)
        scale = 1.0 + min(area_ratio * 3, 1.0)
        labor_hours = round(base_hours * scale, 2)
        return severity, labor_hours

    # --------------------------------------------------------------------------
    # 3. 费用估算
    # --------------------------------------------------------------------------
    def estimate_cost(self, severity: str, labor_hours: float) -> tuple:
        """返回 (parts_cost, labor_cost, total_cost)。"""
        base_cost = self.sev_cfg.get(severity, {}).get("parts_cost_base", 0.0)
        rate = float(self.sev_cfg.get("labor_hour_rate", 120.0))
        labor_cost = round(labor_hours * rate, 2)
        parts_cost = round(base_cost, 2)
        total = round(parts_cost + labor_cost, 2)
        return parts_cost, labor_cost, total

    # --------------------------------------------------------------------------
    # 4. 汇总分类
    # --------------------------------------------------------------------------
    def classify_all(self, regions: List[DamageRegion],
                     case_no: str = "-") -> ClassificationResult:
        """对全部损伤区域分类并汇总费用。"""
        result = ClassificationResult(case_no=case_no)
        try:
            rate = float(self.sev_cfg.get("labor_hour_rate", 120.0))
            for region in regions:
                dtype, conf = self.classify_type(region)
                severity, labor_hours = self.classify_severity(region, dtype)
                parts_cost, labor_cost, total = self.estimate_cost(
                    severity, labor_hours)

                item = DamageItem(
                    body_part=region.body_part,
                    body_part_label=self.part_label_map.get(
                        region.body_part, region.body_part),
                    damage_type=dtype,
                    damage_type_label=TYPE_LABEL.get(dtype, dtype),
                    severity=severity,
                    severity_label=SEVERITY_LABEL.get(severity, severity),
                    area_ratio=region.area_ratio,
                    confidence=conf,
                    labor_hours=labor_hours,
                    parts_cost=parts_cost,
                    labor_cost=labor_cost,
                    total_cost=total,
                )
                result.items.append(item)

                result.total_labor_hours = round(
                    result.total_labor_hours + labor_hours, 2)
                result.total_parts_cost = round(
                    result.total_parts_cost + parts_cost, 2)
                result.total_labor_cost = round(
                    result.total_labor_cost + labor_cost, 2)

            result.grand_total = round(
                result.total_parts_cost + result.total_labor_cost, 2)
            result.success = True

            log.info(
                "损伤分类完成 | case=%s 损伤数=%d 工时=%.1fh 配件=%.2f 工时费=%.2f "
                "合计=%.2f",
                case_no, len(result.items), result.total_labor_hours,
                result.total_parts_cost, result.total_labor_cost,
                result.grand_total)
        except Exception as exc:
            result.error = str(exc)
            result.success = False
            log.error("损伤分类失败 | case=%s err=%s", case_no, exc,
                      exc_info=True)
        return result

    # --------------------------------------------------------------------------
    # 5. 转为理赔系统录入字段 (供 robot_operator 使用)
    # --------------------------------------------------------------------------
    def to_entry_fields(self, result: ClassificationResult,
                        case_no: str = "") -> dict:
        """
        将分类结果转为理赔系统 15 个字段录入值。
        多损伤时取损伤最重的一项作为主损伤信息, 合计费用单独填写。
        """
        if not result.items:
            return {}

        # 取面积占比最大(即最严重)的损伤作为主损伤信息
        main = max(result.items, key=lambda x: x.area_ratio)
        fields = {
            "case_no": case_no or result.case_no,
            "license_plate": "",            # 由案件元数据补全
            "vehicle_model": "",            # 由案件元数据补全
            "damage_part": main.body_part_label,
            "damage_type": main.damage_type_label,
            "damage_severity": main.severity_label,
            "damage_area_ratio": f"{main.area_ratio:.2%}",
            "labor_hours": f"{result.total_labor_hours:.2f}",
            "parts_cost": f"{result.total_parts_cost:.2f}",
            "labor_cost": f"{result.total_labor_cost:.2f}",
            "total_cost": f"{result.grand_total:.2f}",
            "repair_shop": "",              # 由案件元数据补全
            "accident_date": "",            # 由案件元数据补全
            "accident_location": "",        # 由案件元数据补全
            "remark": f"共{len(result.items)}处损伤,主损伤:{main.body_part_label}"
                      f"{main.damage_type_label}({main.severity_label})",
        }
        return fields
