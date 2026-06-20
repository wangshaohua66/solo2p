package com.notarization.model;

import com.notarization.model.enums.HallId;
import com.notarization.model.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String username;

    private String password;

    private String realName;

    @Indexed
    private UserRole role;

    @Indexed
    private HallId hallId;

    private String email;

    private String phone;

    private Boolean available;

    private Boolean enabled;
}
