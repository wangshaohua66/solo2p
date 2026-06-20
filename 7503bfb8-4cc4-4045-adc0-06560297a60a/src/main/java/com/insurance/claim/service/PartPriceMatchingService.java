package com.insurance.claim.service;

import com.insurance.claim.common.BusinessException;
import com.insurance.claim.entity.Claim;
import com.insurance.claim.entity.LossItem;
import com.insurance.claim.entity.PartPriceGuide;
import com.insurance.claim.entity.Policy;
import com.insurance.claim.mapper.PartPriceGuideRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PartPriceMatchingService {

    private final PartPriceGuideRepository partPriceGuideRepository;

    @Value("${claim.part-price.max-deviation:0.3}")
    private BigDecimal maxDeviation;

    @Cacheable(value = "partPrice", key = "#partCode + '_' + #province + '_' + #city")
    public PartPriceGuide matchGuidePrice(String partCode, String partName,
                                           String vehicleBrand, String vehicleModel,
                                           String province, String city) {
        log.info("匹配配件指导价: partCode={}, partName={}, 区域={}-{}",
                partCode, partName, province, city);

        PartPriceGuide guide = partPriceGuideRepository.matchGuidePrice(
                partCode, partName, vehicleBrand, vehicleModel, province, city);

        if (guide != null) {
            log.info("匹配成功: partCode={}, 指导价={}, 供应商={}",
                    partCode, guide.getGuidePrice(), guide.getSupplierName());
            return guide;
        }

        guide = tryFuzzyMatch(partCode, partName, vehicleBrand, province, city);
        if (guide != null) {
            log.info("模糊匹配成功: partCode={}, 指导价={}", partCode, guide.getGuidePrice());
        } else {
            log.warn("未找到指导价: partCode={}, partName={}", partCode, partName);
        }

        return guide;
    }

    private PartPriceGuide tryFuzzyMatch(String partCode, String partName,
                                          String vehicleBrand, String province, String city) {
        if (partCode != null && partCode.length() > 6) {
            String shortCode = partCode.substring(0, 6);
            List<PartPriceGuide> list = partPriceGuideRepository.selectByPartCode(shortCode, province, city);
            if (!list.isEmpty()) {
                return list.get(0);
            }
        }

        if (partName != null) {
            String simpleName = partName.replaceAll("[总成|组件|模块|配件]", "");
            List<PartPriceGuide> list = partPriceGuideRepository.selectByPartCode(simpleName, province, city);
            if (!list.isEmpty()) {
                return list.get(0);
            }
        }

        return null;
    }

    public List<PartPriceGuide> batchMatchGuidePrices(List<LossItem> lossItems,
                                                       Claim claim, Policy policy) {
        List<PartPriceGuide> results = new ArrayList<>();
        String province = claim != null ? claim.getAccidentProvince() : null;
        String city = claim != null ? claim.getAccidentCity() : null;
        String vehicleBrand = policy != null ? policy.getVehicleBrand() : null;
        String vehicleModel = policy != null ? policy.getVehicleModel() : null;

        for (LossItem item : lossItems) {
            if (item.getItemType() != null && item.getItemType() == 1) {
                PartPriceGuide guide = matchGuidePrice(
                        item.getItemCode(), item.getItemName(),
                        vehicleBrand, vehicleModel, province, city);
                if (guide != null) {
                    results.add(guide);
                    applyGuidePrice(item, guide);
                }
            }
        }

        log.info("批量指导价匹配完成: 匹配成功{}/{}个配件", results.size(), lossItems.size());
        return results;
    }

    public void applyGuidePrice(LossItem item, PartPriceGuide guide) {
        if (item == null || guide == null) {
            return;
        }

        item.setGuidePrice(guide.getGuidePrice());

        if (item.getUnitPrice() == null) {
            item.setUnitPrice(guide.getGuidePrice());
            item.setTotalAmount(guide.getGuidePrice().multiply(
                    BigDecimal.valueOf(item.getQuantity() != null ? item.getQuantity() : 1))
                    .setScale(2, RoundingMode.HALF_UP));
            log.info("应用指导价: {} = {} x {}", item.getItemName(), guide.getGuidePrice(), item.getQuantity());
            return;
        }

        if (guide.getGuidePrice().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal deviation = item.getUnitPrice()
                    .subtract(guide.getGuidePrice())
                    .abs()
                    .divide(guide.getGuidePrice(), 4, RoundingMode.HALF_UP);

            item.setExceedRatio(deviation.multiply(BigDecimal.valueOf(100)));
            item.setExceedGuidePrice(deviation.compareTo(maxDeviation) > 0);

            if (Boolean.TRUE.equals(item.getExceedGuidePrice())) {
                log.warn("配件价格超标: {}={}, 指导价={}, 偏差={}%",
                        item.getItemName(), item.getUnitPrice(), guide.getGuidePrice(),
                        deviation.multiply(BigDecimal.valueOf(100)).setScale(2));
            }
        }
    }

    public BigDecimal calculatePriceDeviation(BigDecimal actualPrice, BigDecimal guidePrice) {
        if (actualPrice == null || guidePrice == null || guidePrice.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return actualPrice.subtract(guidePrice)
                .divide(guidePrice, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
    }

    public boolean isExceedStandard(BigDecimal actualPrice, BigDecimal guidePrice) {
        return calculatePriceDeviation(actualPrice, guidePrice)
                .compareTo(maxDeviation.multiply(BigDecimal.valueOf(100))) > 0;
    }
}
