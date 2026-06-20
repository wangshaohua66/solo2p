package com.mw.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Arrays;
import java.util.List;

@Getter
@AllArgsConstructor
public enum WasteCategory {

    INFECTIOUS("感染性废物", "携带病原微生物,具有引发感染性疾病传播风险的废物"),
    SHARPS("损伤性废物", "能够刺伤或者割伤人体的废弃医用锐器"),
    PATHOLOGICAL("病理性废物", "诊疗过程中产生的人体废弃物和医学实验动物尸体等"),
    PHARMACEUTICAL("药物性废物", "过期、淘汰、变质或者污染的废弃药品"),
    CHEMICAL("化学性废物", "具有毒性、腐蚀性、易燃易爆性的废弃化学物品");

    private final String name;
    private final String desc;

    public static boolean isValid(String code) {
        return Arrays.stream(values()).anyMatch(c -> c.name().equals(code));
    }

    public static List<String> codes() {
        return Arrays.stream(values()).map(Enum::name).toList();
    }
}
