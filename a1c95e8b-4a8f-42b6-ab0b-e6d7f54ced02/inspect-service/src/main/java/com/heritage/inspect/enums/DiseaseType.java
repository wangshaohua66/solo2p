package com.heritage.inspect.enums;

import lombok.Getter;

@Getter
public enum DiseaseType {
    CRACK("CRACK", "开裂"),
    DEFORMATION("DEFORMATION", "变形"),
    CORROSION("CORROSION", "腐蚀"),
    PEELING("PEELING", "剥落"),
    DISCOLORATION("DISCOLORATION", "变色"),
    FUNGUS("FUNGUS", "霉变"),
    PEST("PEST", "虫蛀"),
    WEATHERING("WEATHERING", "风化"),
    WATER_DAMAGE("WATER_DAMAGE", "水渍"),
    FIRE_DAMAGE("FIRE_DAMAGE", "火灾损伤"),
    OTHER("OTHER", "其他");

    private final String code;
    private final String name;

    DiseaseType(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
