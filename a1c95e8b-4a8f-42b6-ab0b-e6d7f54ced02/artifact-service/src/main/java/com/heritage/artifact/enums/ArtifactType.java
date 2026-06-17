package com.heritage.artifact.enums;

import lombok.Getter;

@Getter
public enum ArtifactType {

    PAINTING("PAINTING", "绘画"),
    CALLIGRAPHY("CALLIGRAPHY", "书法"),
    SCULPTURE("SCULPTURE", "雕塑"),
    CERAMIC("CERAMIC", "陶瓷"),
    JADE("JADE", "玉器"),
    BRONZE("BRONZE", "青铜器"),
    METAL("METAL", "金属器"),
    TEXTILE("TEXTILE", "织绣"),
    FURNITURE("FURNITURE", "家具"),
    DOCUMENT("DOCUMENT", "文献"),
    COIN("COIN", "钱币"),
    BUILDING("BUILDING", "古建筑"),
    STONE_CARVING("STONE_CARVING", "石刻"),
    MURAL("MURAL", "壁画"),
    OTHER("OTHER", "其他");

    private final String code;
    private final String name;

    ArtifactType(String code, String name) {
        this.code = code;
        this.name = name;
    }
}
