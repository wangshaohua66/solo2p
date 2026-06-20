package com.notarization.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "hash_chains")
public class HashChain {

    @Id
    private String id;

    private String chainName;

    @Indexed
    private String caseId;

    @Indexed(unique = true)
    private String chainId;

    private String genesisHash;

    private Long length;

    private String lastHash;

    private Instant lastUpdateTime;
}
