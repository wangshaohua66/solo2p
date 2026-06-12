package com.carbon.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@AllArgsConstructor
public enum GreenhouseGas {

    CO2("CO2", "二氧化碳", new BigDecimal("1")),
    CH4("CH4", "甲烷", new BigDecimal("28")),
    N2O("N2O", "氧化亚氮", new BigDecimal("265")),
    HFC_23("HFC-23", "三氟甲烷", new BigDecimal("12400")),
    HFC_32("HFC-32", "二氟甲烷", new BigDecimal("675")),
    HFC_125("HFC-125", "五氟乙烷", new BigDecimal("3170")),
    HFC_134a("HFC-134a", "1,1,1,2-四氟乙烷", new BigDecimal("1300")),
    HFC_143a("HFC-143a", "1,1,1-三氟乙烷", new BigDecimal("4800")),
    PFC_C2F6("PFC-C2F6", "六氟乙烷", new BigDecimal("11100")),
    PFC_CF4("PFC-CF4", "四氟化碳", new BigDecimal("6630")),
    SF6("SF6", "六氟化硫", new BigDecimal("23500")),
    NF3("NF3", "三氟化氮", new BigDecimal("16100"));

    private final String code;
    private final String name;
    private final BigDecimal gwp100Ar6;
}
