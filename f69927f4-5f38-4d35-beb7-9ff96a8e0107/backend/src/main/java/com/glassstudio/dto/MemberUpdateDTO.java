package com.glassstudio.dto;

import com.glassstudio.entity.MemberRole;
import com.glassstudio.entity.MemberStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberUpdateDTO {

    private String realName;

    private String email;

    private String phone;

    private MemberRole role;

    private MemberStatus status;
}
