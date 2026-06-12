package com.carbon.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ActivityDataType {

    FUEL_COMBUSTION("FUEL_COMBUSTION", "燃料燃烧", "t", "TJ"),
    PURCHASED_ELECTRICITY("PURCHASED_ELECTRICITY", "购入电力", "MWh", "MWh"),
    PURCHASED_HEAT("PURCHASED_HEAT", "购入热力/蒸汽", "GJ", "GJ"),
    PURCHASED_STEAM("PURCHASED_STEAM", "购入蒸汽", "t", "GJ"),
    RAW_MATERIAL("RAW_MATERIAL", "原材料投入", "t", "t"),
    PROCESS_EMISSION("PROCESS_EMISSION", "工艺排放", "t", "t"),
    FUGITIVE_EMISSION("FUGITIVE_EMISSION", "逃逸排放", "kg", "t"),
    TRANSPORT_UPSTREAM("TRANSPORT_UPSTREAM", "上游运输", "t·km", "t·km"),
    TRANSPORT_DOWNSTREAM("TRANSPORT_DOWNSTREAM", "下游运输", "t·km", "t·km"),
    BUSINESS_TRAVEL_AIR("BUSINESS_TRAVEL_AIR", "商务差旅-航空", "km", "p·km"),
    BUSINESS_TRAVEL_RAIL("BUSINESS_TRAVEL_RAIL", "商务差旅-铁路", "km", "p·km"),
    BUSINESS_TRAVEL_ROAD("BUSINESS_TRAVEL_ROAD", "商务差旅-公路", "km", "p·km"),
    EMPLOYEE_COMMUTE("EMPLOYEE_COMMUTE", "员工通勤", "km", "p·km"),
    WASTE_DISPOSAL("WASTE_DISPOSAL", "废弃物处置", "t", "t"),
    WASTEWATER("WASTEWATER", "废水处理", "m³", "m³"),
    CAPITAL_GOODS("CAPITAL_GOODS", "资本货物", "t", "t"),
    LEASED_ASSETS_UP("LEASED_ASSETS_UP", "上游租赁资产", "t", "t"),
    LEASED_ASSETS_DOWN("LEASED_ASSETS_DOWN", "下游租赁资产", "t", "t"),
    FRANCHISES("FRANCHISES", "特许经营", "t", "t"),
    INVESTMENTS("INVESTMENTS", "投资活动", "t", "t"),
    USE_OF_SOLD_PRODUCTS("USE_OF_SOLD_PRODUCTS", "售出产品使用阶段", "t", "t"),
    END_OF_LIFE("END_OF_LIFE", "产品废弃处理", "t", "t");

    private final String code;
    private final String label;
    private final String inputUnit;
    private final String activityUnit;
}
