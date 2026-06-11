package com.glassstudio.mapper;

import com.glassstudio.dto.MemberCreateDTO;
import com.glassstudio.dto.MemberUpdateDTO;
import com.glassstudio.entity.Member;
import javax.annotation.processing.Generated;
import org.springframework.stereotype.Component;

@Generated(
    value = "org.mapstruct.ap.MappingProcessor",
    date = "2026-06-11T12:19:09+0800",
    comments = "version: 1.5.5.Final, compiler: Eclipse JDT (IDE) 3.46.0.v20260407-0427, environment: Java 21.0.10 (Eclipse Adoptium)"
)
@Component
public class MemberMapperImpl implements MemberMapper {

    @Override
    public Member toEntity(MemberCreateDTO dto) {
        if ( dto == null ) {
            return null;
        }

        Member.MemberBuilder member = Member.builder();

        member.email( dto.getEmail() );
        member.phone( dto.getPhone() );
        member.realName( dto.getRealName() );
        member.role( dto.getRole() );
        member.username( dto.getUsername() );

        return member.build();
    }

    @Override
    public void updateEntity(MemberUpdateDTO dto, Member entity) {
        if ( dto == null ) {
            return;
        }

        if ( dto.getEmail() != null ) {
            entity.setEmail( dto.getEmail() );
        }
        if ( dto.getPhone() != null ) {
            entity.setPhone( dto.getPhone() );
        }
        if ( dto.getRealName() != null ) {
            entity.setRealName( dto.getRealName() );
        }
        if ( dto.getRole() != null ) {
            entity.setRole( dto.getRole() );
        }
        if ( dto.getStatus() != null ) {
            entity.setStatus( dto.getStatus() );
        }
    }
}
