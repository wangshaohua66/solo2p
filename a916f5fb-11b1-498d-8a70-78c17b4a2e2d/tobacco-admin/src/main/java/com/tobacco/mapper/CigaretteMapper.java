package com.tobacco.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.entity.Cigarette;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface CigaretteMapper extends BaseMapper<Cigarette> {

    Cigarette selectByCode(@Param("cigaretteCode") String cigaretteCode);

    IPage<Cigarette> selectPageByCondition(Page<Cigarette> page,
                                            @Param("status") Integer status,
                                            @Param("brand") String brand,
                                            @Param("category") String category,
                                            @Param("keyword") String keyword);

    List<Cigarette> selectAllAvailable();
}
