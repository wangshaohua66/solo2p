package com.mw.disposal.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TimeValue {

    private Long timestamp;
    private Double value;
}
