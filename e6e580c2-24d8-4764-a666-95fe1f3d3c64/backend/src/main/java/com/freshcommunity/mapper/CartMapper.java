package com.freshcommunity.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.freshcommunity.entity.Cart;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CartMapper extends BaseMapper<Cart> {
}
