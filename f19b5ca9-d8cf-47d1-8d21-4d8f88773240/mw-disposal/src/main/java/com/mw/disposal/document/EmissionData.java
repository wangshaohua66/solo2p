package com.mw.disposal.document;

import lombok.Data;

@Data
public class EmissionData {

    private Double coMgPerM3;

    private Double dioxinNgTeq;

    private Double particulateMgPerM3;

    private Double so2MgPerM3;

    private Boolean qualified;

    private Long monitorTs;
}
