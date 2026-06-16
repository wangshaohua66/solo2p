package com.crew.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.crew.entity.Flight;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FlightMapper extends BaseMapper<Flight> {
}
