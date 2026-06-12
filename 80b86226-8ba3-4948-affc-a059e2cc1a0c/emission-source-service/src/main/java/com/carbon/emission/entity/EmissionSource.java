package com.carbon.emission.entity;

import com.carbon.common.entity.BaseEntity;
import com.carbon.common.enums.ActivityDataType;
import com.carbon.common.enums.ScopeType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "emission_sources")
@CompoundIndex(name = "tenant_code_unq", def = "{'tenantId': 1, 'code': 1}", unique = true)
@CompoundIndex(name = "tenant_scope_status_idx", def = "{'tenantId': 1, 'scope': 1, 'status': 1}")
public class EmissionSource extends BaseEntity {

    @Indexed
    private String code;

    private String name;

    private ScopeType scope;

    private String category;

    private String subCategory;

    private ActivityDataType activityDataType;

    private String facility;

    private String process;

    private String department;

    private String location;

    private Double longitude;

    private Double latitude;

    private String device;

    private String deviceSpecification;

    private Double ratedCapacity;

    private String capacityUnit;

    private String fuelCode;

    private String fuelDescription;

    private String factorMatchKey;

    private List<String> factorCandidateKeys;

    private String unit;

    private String owner;

    private String monitorMethod;

    @Builder.Default
    private Map<String, String> parameters = new HashMap<>();

    private String parentId;

    private List<String> tags;

    @Builder.Default
    private String status = "ACTIVE";

    @Builder.Default
    private Boolean verified = false;

    private String verificationNote;

    @Builder.Default
    private Map<String, Object> extensions = new HashMap<>();
}
