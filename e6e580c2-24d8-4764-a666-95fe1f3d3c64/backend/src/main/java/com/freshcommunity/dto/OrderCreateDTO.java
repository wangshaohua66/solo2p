package com.freshcommunity.dto;

import lombok.Data;
import java.io.Serializable;
import java.util.List;

@Data
public class OrderCreateDTO implements Serializable {

    private Long userId;

    private Long communityId;

    private String remark;

    private List<OrderItemDTO> items;

    @Data
    public static class OrderItemDTO implements Serializable {
        private Long productId;
        private String productName;
        private String productImage;
        private Long communityId;
        private Integer quantity;
    }
}
