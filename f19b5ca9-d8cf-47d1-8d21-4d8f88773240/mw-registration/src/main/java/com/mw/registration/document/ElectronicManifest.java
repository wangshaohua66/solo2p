package com.mw.registration.document;

import com.mw.common.document.BaseDocument;
import com.mw.common.enums.ManifestStatus;
import com.mw.common.enums.WasteCategory;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "electronic_manifest")
public class ElectronicManifest extends BaseDocument {

    @Indexed(unique = true)
    private String manifestNo;

    @Indexed
    private String orgId;

    private String orgName;

    /** 联单中各废物类别重量 */
    private Map<WasteCategory, Double> categoryWeights;

    private Double totalWeightKg;

    private List<String> traceCodes;

    /** 收运单位 */
    private String transporterOrgId;

    private String transporterOrgName;

    /** 处置单位 */
    private String disposerOrgId;

    private String disposerOrgName;

    /** 包装二维码内容（追溯编码集合） */
    private String packageQrCode;

    private ManifestStatus status;

    /** 联单PDF文件存储Key */
    private String pdfStorageKey;

    /** 操作日志：作废/补录/变更 */
    private List<ManifestOperateLog> operateLogs;

    @Data
    public static class ManifestOperateLog {
        private String operatorId;
        private String operatorName;
        private String action;
        private String remark;
        private String operateTime;
    }
}
