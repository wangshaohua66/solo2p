package com.emergency.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum IncidentType {

    EARTHQUAKE("地震", 1),
    FLOOD("洪涝", 2),
    FIRE("火灾", 3),
    TYPHOON("台风", 4),
    LANDSLIDE("山体滑坡", 5),
    MUD_FLOW("泥石流", 6),
    HAILSTORM("冰雹", 7),
    DROUGHT("干旱", 8),
    HAZMAT("危化品泄漏", 9),
    OTHER("其他灾害", 99);

    private final String description;
    private final int code;

    public static IncidentType fromCode(int code) {
        for (IncidentType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        return OTHER;
    }
}
