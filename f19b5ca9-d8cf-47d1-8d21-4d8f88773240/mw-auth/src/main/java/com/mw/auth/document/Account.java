package com.mw.auth.document;

import com.mw.common.document.BaseDocument;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Set;

@Data
@EqualsAndHashCode(callSuper = true)
@Document(collection = "account")
public class Account extends BaseDocument {

    @Indexed(unique = true)
    private String username;

    private String passwordHash;

    private String realName;

    @Indexed
    private String orgId;

    private String orgName;

    private Set<String> roles;

    private Boolean enabled = true;
}
