package com.wedding.suite.util;

import com.wedding.suite.dto.response.QuoteItemVO;
import com.wedding.suite.dto.response.QuoteVO;
import com.wedding.suite.entity.AddonEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.entity.PackageItemEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
public class PricingCalculator {

    private static int perGuestAdjust(int guests) {
        if (guests <= 8) return 0;
        return (guests - 8) * 320;
    }

    private static BigDecimal round(BigDecimal v) {
        return v.setScale(0, RoundingMode.HALF_UP);
    }

    public QuoteVO calcQuote(PackageEntity pkg, int guests, Set<Long> serviceIds,
                             Map<AddonEntity, Integer> addons, BigDecimal discountCoefficient) {
        List<QuoteItemVO> items = new ArrayList<>();

        for (PackageItemEntity it : pkg.getItems()) {
            if (Boolean.TRUE.equals(it.getIncluded())) {
                items.add(new QuoteItemVO(it.getName(), it.getCost(), it.getPrice(), 1));
            }
        }

        for (PackageItemEntity it : pkg.getItems()) {
            if (!Boolean.TRUE.equals(it.getIncluded()) && serviceIds != null && serviceIds.contains(it.getId())) {
                items.add(new QuoteItemVO(it.getName(), it.getCost(), it.getPrice(), 1));
            }
        }

        int guestAdj = perGuestAdjust(guests);
        BigDecimal guestAdjCost = round(BigDecimal.valueOf(guestAdj).multiply(new BigDecimal("0.7")));
        BigDecimal guestAdjPrice = BigDecimal.valueOf(guestAdj);
        if (guests > 8) {
            items.add(new QuoteItemVO("超桌加位（" + (guests - 8) + "桌）", guestAdjCost, guestAdjPrice, 1));
        }

        if (addons != null) {
            for (Map.Entry<AddonEntity, Integer> e : addons.entrySet()) {
                int qty = e.getValue();
                if (qty <= 0) continue;
                AddonEntity a = e.getKey();
                items.add(new QuoteItemVO(
                        a.getName() + " ×" + qty,
                        a.getCost().multiply(BigDecimal.valueOf(qty)),
                        a.getPrice().multiply(BigDecimal.valueOf(qty)),
                        qty));
            }
        }

        BigDecimal itemsCost = BigDecimal.ZERO;
        BigDecimal itemsPrice = BigDecimal.ZERO;
        for (QuoteItemVO i : items) {
            itemsCost = itemsCost.add(i.getCost());
            itemsPrice = itemsPrice.add(i.getPrice());
        }

        BigDecimal basePrice = pkg.getBasePrice();
        BigDecimal basePriceCost = round(basePrice.multiply(new BigDecimal("0.55")));
        items.add(0, new QuoteItemVO("套餐基础服务", basePriceCost, basePrice, 1));

        BigDecimal totalCost = itemsCost.add(basePriceCost);
        BigDecimal grossPrice = itemsPrice.add(basePrice);
        BigDecimal discount = round(grossPrice.multiply(BigDecimal.ONE.subtract(discountCoefficient)));
        BigDecimal total = grossPrice.subtract(discount);
        BigDecimal profit = total.subtract(totalCost);
        BigDecimal margin = total.compareTo(BigDecimal.ZERO) > 0
                ? profit.multiply(BigDecimal.TEN).divide(total, 1, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return new QuoteVO(items, totalCost, grossPrice, discount, total, profit, margin);
    }
}
