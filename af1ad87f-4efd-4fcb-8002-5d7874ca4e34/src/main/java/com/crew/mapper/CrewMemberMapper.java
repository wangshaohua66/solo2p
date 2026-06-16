package com.crew.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crew.entity.CrewMember;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CrewMemberMapper extends BaseMapper<CrewMember> {
}
