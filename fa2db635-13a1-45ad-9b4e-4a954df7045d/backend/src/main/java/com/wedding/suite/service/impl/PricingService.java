package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.AddonQtyRequest;
import com.wedding.suite.dto.request.PricingCalcRequest;
import com.wedding.suite.dto.response.QuoteVO;
import com.wedding.suite.entity.AddonEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.entity.StoreEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.AddonRepository;
import com.wedding.suite.repository.PackageRepository;
import com.wedding.suite.repository.StoreRepository;
import com.wedding.suite.util.PricingCalculator;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
public class PricingService {

    private final PackageRepository packageRepo;
    private final StoreRepository storeRepo;
    private final AddonRepository addonRepo;
    private final PricingCalculator calculator;

    public PricingService(PackageRepository packageRepo, StoreRepository storeRepo,
                          AddonRepository addonRepo, PricingCalculator calculator) {
        this.packageRepo = packageRepo;
        this.storeRepo = storeRepo;
        this.addonRepo = addonRepo;
        this.calculator = calculator;
    }

    public QuoteVO calc(PricingCalcRequest req) {
        PackageEntity pkg = packageRepo.findById(req.getPackageId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在"));
        StoreEntity store = storeRepo.findById(req.getStoreId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "门店不存在"));
        Set<Long> serviceIds = req.getServiceIds() == null ? new HashSet<>() : new HashSet<>(req.getServiceIds());
        Map<AddonEntity, Integer> addons = new LinkedHashMap<>();
        if (req.getAddons() != null) {
            for (AddonQtyRequest a : req.getAddons()) {
                AddonEntity addon = addonRepo.findById(a.getAddonId())
                        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "附加项不存在"));
                addons.put(addon, a.getQty());
            }
        }
        return calculator.calcQuote(pkg, req.getGuests(), serviceIds, addons, store.getDiscountCoefficient());
    }
}
