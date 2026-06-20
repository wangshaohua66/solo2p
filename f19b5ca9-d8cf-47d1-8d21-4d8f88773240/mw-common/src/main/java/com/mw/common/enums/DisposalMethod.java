package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum DisposalMethod {

    STEAM_STERILIZATION("高温蒸汽灭菌", 121.0, 30),
    MICROWAVE_DISINFECTION("微波消毒", 95.0, 45),
    CHEMICAL_DISINFECTION("化学消毒", 25.0, 60),
    INCINERATION("焚烧处置", 850.0, 120);

    private final String name;
    private final double minTemperature;
    private final int minDurationMinutes;
}
