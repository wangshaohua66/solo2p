package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.tobacco.entity.SystemMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SystemMessageMapper extends BaseMapper<SystemMessage> {

    @Select("SELECT * FROM sys_message WHERE receiver_id = #{receiverId} AND is_read = 0 AND deleted = 0 ORDER BY create_time DESC")
    List<SystemMessage> selectUnreadByReceiverId(@Param("receiverId") Long receiverId);
}
