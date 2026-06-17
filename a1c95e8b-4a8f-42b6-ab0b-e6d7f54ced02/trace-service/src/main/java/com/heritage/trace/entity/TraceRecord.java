package com.heritage.trace.entity;

import com.heritage.trace.enums.FlowType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "trace_records")
@CompoundIndexes({
    @CompoundIndex(name = "artifact_time_idx", def = "{'artifactId': 1, 'createTime': -1}")
})
public class TraceRecord {
    @Id
    private String id;

    @Indexed
    private String artifactId;

    @Indexed
    private String artifactCode;

    private String artifactName;

    private FlowType flowType;

    private String fromLocation;

    private String toLocation;

    private String operatorId;

    private String operatorName;

    private String handlerId;

    private String handlerName;

    private String remark;

    @Builder.Default
    private List<String> attachments = new ArrayList<>();

    private String blockchainHash;

    private String previousHash;

    @Indexed
    @CreatedDate
    private LocalDateTime createTime;

    private LocalDateTime actualTime;

    private String signature;
}
