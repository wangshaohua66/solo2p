package com.freshcommunity.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.freshcommunity.dto.OrderCreateDTO;
import com.freshcommunity.entity.*;
import com.freshcommunity.mapper.OrderItemMapper;
import com.freshcommunity.mapper.OrderMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
public class OrderService extends ServiceImpl<OrderMapper, Order> {

    @Autowired
    private OrderItemMapper orderItemMapper;

    @Autowired
    private ProductCommunityStockService stockService;

    @Autowired
    private ProductService productService;

    @Autowired
    private ResidentUserService residentUserService;

    @Autowired
    private GroupLeaderService groupLeaderService;

    @Autowired
    private CartService cartService;

    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(OrderCreateDTO dto) {
        Order order = new Order();
        order.setOrderNo(generateOrderNo());
        order.setUserId(dto.getUserId());
        order.setCommunityId(dto.getCommunityId());
        order.setRemark(dto.getRemark());
        order.setStatus(0);
        order.setPayStatus(0);
        order.setDeliveryStatus(0);
        order.setDiscountAmount(BigDecimal.ZERO);
        order.setPickupCode(generatePickupCode());

        GroupLeader leader = groupLeaderService.getLeaderByCommunityId(dto.getCommunityId());
        if (leader != null) {
            order.setLeaderId(leader.getId());
        }

        BigDecimal totalAmount = BigDecimal.ZERO;
        List<OrderItem> items = new ArrayList<>();

        for (OrderCreateDTO.OrderItemDTO itemDTO : dto.getItems()) {
            Product product = productService.getById(itemDTO.getProductId());
            if (product == null || product.getStatus() != 1) {
                throw new RuntimeException("商品[" + itemDTO.getProductName() + "]不可购买");
            }
            ProductCommunityStock stock = stockService.getStock(itemDTO.getProductId(), itemDTO.getCommunityId());
            if (stock == null || stock.getStock() < itemDTO.getQuantity()) {
                throw new RuntimeException("商品[" + product.getName() + "]库存不足");
            }
            boolean locked = stockService.lockStock(itemDTO.getProductId(), itemDTO.getCommunityId(), itemDTO.getQuantity());
            if (!locked) {
                throw new RuntimeException("商品[" + product.getName() + "]库存锁定失败");
            }
            BigDecimal itemPrice = stock.getPrice() != null ? stock.getPrice() : product.getSellingPrice();
            BigDecimal itemTotal = itemPrice.multiply(BigDecimal.valueOf(itemDTO.getQuantity()));

            OrderItem orderItem = new OrderItem();
            orderItem.setProductId(itemDTO.getProductId());
            orderItem.setProductName(product.getName());
            orderItem.setProductImage(product.getImageUrl());
            orderItem.setPrice(itemPrice);
            orderItem.setQuantity(itemDTO.getQuantity());
            orderItem.setTotalPrice(itemTotal);
            orderItem.setCommunityId(itemDTO.getCommunityId());
            items.add(orderItem);

            totalAmount = totalAmount.add(itemTotal);
        }

        order.setTotalAmount(totalAmount);
        order.setPayAmount(totalAmount);

        save(order);
        for (OrderItem item : items) {
            item.setOrderId(order.getId());
            item.setOrderNo(order.getOrderNo());
            orderItemMapper.insert(item);
        }

        return order;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean payOrder(Long orderId) {
        Order order = getById(orderId);
        if (order == null || order.getStatus() != 0) {
            return false;
        }
        order.setStatus(1);
        order.setPayStatus(1);
        order.setPayTime(LocalDateTime.now());

        List<OrderItem> items = getOrderItems(order.getId());
        for (OrderItem item : items) {
            stockService.deductStock(item.getProductId(), item.getCommunityId(), item.getQuantity());
            productService.increaseSoldCount(item.getProductId(), item.getQuantity());
        }

        boolean success = updateById(order);
        if (success) {
            residentUserService.updateUserAmount(order.getUserId(), order.getPayAmount(), 1);
            cartService.clearCart(order.getUserId());
        }
        return success;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean cancelOrder(Long orderId, String cancelReason) {
        Order order = getById(orderId);
        if (order == null || (order.getStatus() != 0 && order.getStatus() != 1)) {
            return false;
        }
        order.setStatus(5);
        order.setCancelReason(cancelReason);
        order.setDeliveryStatus(3);

        List<OrderItem> items = getOrderItems(order.getId());
        for (OrderItem item : items) {
            if (order.getStatus() == 0) {
                stockService.releaseStock(item.getProductId(), item.getCommunityId(), item.getQuantity());
            }
        }
        return updateById(order);
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean applyRefund(Long orderId, String reason) {
        Order order = getById(orderId);
        if (order == null) {
            return false;
        }
        order.setStatus(5);
        order.setCancelReason(reason);
        order.setDeliveryStatus(3);
        return updateById(order);
    }

    public boolean updateOrderStatus(Long orderId, Integer status) {
        Order order = getById(orderId);
        if (order == null) {
            return false;
        }
        order.setStatus(status);
        return updateById(order);
    }

    public boolean updateDeliveryStatus(Long orderId, Integer deliveryStatus) {
        Order order = getById(orderId);
        if (order == null) {
            return false;
        }
        order.setDeliveryStatus(deliveryStatus);
        if (deliveryStatus == 2) {
            order.setStatus(3);
        } else if (deliveryStatus == 4) {
            order.setStatus(4);
        }
        return updateById(order);
    }

    public List<OrderItem> getOrderItems(Long orderId) {
        return orderItemMapper.selectList(new LambdaQueryWrapper<OrderItem>().eq(OrderItem::getOrderId, orderId));
    }

    public Page<Order> getOrderPage(int pageNum, int pageSize, String orderNo, Long userId,
                                    Long communityId, Integer status, String startDate, String endDate) {
        Page<Order> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(orderNo)) {
            wrapper.like(Order::getOrderNo, orderNo);
        }
        if (userId != null) {
            wrapper.eq(Order::getUserId, userId);
        }
        if (communityId != null) {
            wrapper.eq(Order::getCommunityId, communityId);
        }
        if (status != null) {
            wrapper.eq(Order::getStatus, status);
        }
        if (StringUtils.hasText(startDate)) {
            wrapper.ge(Order::getCreateTime, LocalDateTime.parse(startDate + " 00:00:00", DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }
        if (StringUtils.hasText(endDate)) {
            wrapper.le(Order::getCreateTime, LocalDateTime.parse(endDate + " 23:59:59", DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        }
        wrapper.orderByDesc(Order::getCreateTime);
        return page(page, wrapper);
    }

    public List<Order> getOrdersByCommunityAndStatus(Long communityId, Integer status) {
        return list(new LambdaQueryWrapper<Order>()
                .eq(Order::getCommunityId, communityId)
                .eq(Order::getStatus, status));
    }

    public List<Order> getPendingDeliveryOrders(Long communityId) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<Order>()
                .eq(Order::getStatus, 1)
                .eq(Order::getDeliveryStatus, 0);
        if (communityId != null) {
            wrapper.eq(Order::getCommunityId, communityId);
        }
        return list(wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public int cancelTimeoutOrders() {
        LocalDateTime timeout = LocalDateTime.now().minusMinutes(30);
        List<Order> timeoutOrders = list(new LambdaQueryWrapper<Order>()
                .eq(Order::getStatus, 0)
                .lt(Order::getCreateTime, timeout));
        int count = 0;
        for (Order order : timeoutOrders) {
            List<OrderItem> items = getOrderItems(order.getId());
            for (OrderItem item : items) {
                stockService.releaseStock(item.getProductId(), item.getCommunityId(), item.getQuantity());
            }
            order.setStatus(5);
            order.setCancelReason("超时未付款自动取消");
            order.setDeliveryStatus(3);
            updateById(order);
            count++;
        }
        log.info("自动取消超时订单 {} 笔", count);
        return count;
    }

    private String generateOrderNo() {
        return "ORD" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private String generatePickupCode() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(1000000));
    }
}
