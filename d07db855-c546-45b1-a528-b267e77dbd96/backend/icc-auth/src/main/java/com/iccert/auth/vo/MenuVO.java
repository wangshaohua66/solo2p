package com.iccert.auth.vo;

import lombok.Data;
import java.util.List;

@Data
public class MenuVO {
    private Long id;
    private Long parentId;
    private String menuName;
    private String menuPath;
    private String menuIcon;
    private String component;
    private Integer menuType;
    private Integer sort;
    private List<MenuVO> children;
}
