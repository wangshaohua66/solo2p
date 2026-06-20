package com.freshcommunity.task;

import com.freshcommunity.service.OrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class OrderTimeoutTask {

    @Autowired
    private OrderService orderService;

    @Scheduled(fixedRate = 60000)
    public void cancelTimeoutOrders() {
        try {
            int count = orderService.cancelTimeoutOrders();
            if (count > 0) {
                log.info("定时任务：自动取消超时未付款订单 {} 笔", count);
            }
        } catch (Exception e) {
            log.error("定时取消超时订单异常", e);
        }
    }
}
