package com.carbon.service;

import com.carbon.common.response.PageResult;
import com.carbon.dto.trade.*;
import com.carbon.vo.trade.TradeOrderVO;

public interface TradeService {

    TradeOrderVO createListing(TradeListingDTO dto);

    TradeOrderVO createAgreement(TradeAgreementDTO dto);

    TradeOrderVO matchOrder(TradeMatchDTO dto);

    TradeOrderVO cancelOrder(Long orderId);

    TradeOrderVO getById(Long id);

    PageResult<TradeOrderVO> page(TradeQueryDTO dto);
}
