package com.notarization.dto;

import com.notarization.model.enums.CaseStatus;
import com.notarization.model.enums.HallId;
import com.notarization.model.enums.NotarizationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseSearchRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    private String keyword;

    private CaseStatus status;

    private NotarizationType caseType;

    private HallId hallId;

    private String notaryId;

    private int page;

    private int size;
}
