package com.mw.registration.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.WasteCategory;
import com.mw.common.enums.WasteStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "waste_record")
public class WasteRecord extends BaseDocument {

    @Indexed(unique = true)
    private String traceCode;

    @Indexed
    private String orgId;

    private String orgName;

    /** 产废科室 */
    private String department;

    private WasteCategory category;

    private Double weightKg;

    /** 包装编号 */
    private String packageNo;

    private String operatorId;

    private String operatorName;

    /** 暂存开始时间 */
    @Indexed
    private LocalDateTime storageTime;

    private WasteStatus status;

    /** 暂存状态照片附件URL */
    private List<String> attachmentUrls;

    /** 关联电子联单号 */
    @Indexed
    private String manifestNo;
}
