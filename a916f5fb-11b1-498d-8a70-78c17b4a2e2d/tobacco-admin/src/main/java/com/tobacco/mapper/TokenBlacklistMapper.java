package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.TokenBlacklist;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TokenBlacklistMapper extends BaseMapper<TokenBlacklist> {

    @Select("SELECT COUNT(*) FROM token_blacklist WHERE token = #{token}")
    Integer countByToken(@Param("token") String token);
}
