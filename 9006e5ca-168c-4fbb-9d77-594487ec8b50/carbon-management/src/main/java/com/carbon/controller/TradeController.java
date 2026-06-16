package com.carbon.controller;

import com.carbon.common.response.PageResult;
import com.carbon.common.response.R;
import com.carbon.dto.trade.*;
import com.carbon.service.TradeService;
import com.carbon.vo.trade.TradeOrderVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/trade")
@RequiredArgsConstructor
public class TradeController {

    private final TradeService tradeService;

    @PostMapping("/listing")
    public R<TradeOrderVO> createListing(@Valid @RequestBody TradeListingDTO dto) {
        return R.ok(tradeService.createListing(dto));
    }

    @PostMapping("/agreement")
    public R<TradeOrderVO> createAgreement(@Valid @RequestBody TradeAgreementDTO dto) {
        return R.ok(tradeService.createAgreement(dto));
    }

    @PostMapping("/match")
    public R<TradeOrderVO> matchOrder(@Valid @RequestBody TradeMatchDTO dto) {
        return R.ok(tradeService.matchOrder(dto));
    }

    @PostMapping("/cancel/{orderId}")
    public R<TradeOrderVO> cancelOrder(@PathVariable Long orderId) {
        return R.ok(tradeService.cancelOrder(orderId));
    }

    @GetMapping("/{id}")
    public R<TradeOrderVO> getById(@PathVariable Long id) {
        return R.ok(tradeService.getById(id));
    }

    @GetMapping("/page")
    public R<PageResult<TradeOrderVO>> page(TradeQueryDTO dto) {
        return R.ok(tradeService.page(dto));
    }
}
