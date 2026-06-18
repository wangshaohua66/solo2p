package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.PackageItemRequest;
import com.wedding.suite.dto.request.PackageSaveRequest;
import com.wedding.suite.entity.AddonEntity;
import com.wedding.suite.entity.PackageEntity;
import com.wedding.suite.entity.PackageItemEntity;
import com.wedding.suite.enums.PackageItemType;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.AddonRepository;
import com.wedding.suite.repository.PackageRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PackageService {

    private final PackageRepository packageRepo;
    private final AddonRepository addonRepo;

    public PackageService(PackageRepository packageRepo, AddonRepository addonRepo) {
        this.packageRepo = packageRepo;
        this.addonRepo = addonRepo;
    }

    public List<PackageEntity> list() {
        return packageRepo.findAll();
    }

    public PackageEntity save(PackageSaveRequest req) {
        PackageEntity pkg;
        if (req.getId() != null) {
            pkg = packageRepo.findById(req.getId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "套餐不存在"));
            pkg.setName(req.getName());
            pkg.setBasePrice(req.getBasePrice());
            pkg.setDescription(req.getDescription());
            if (pkg.getItems() != null) pkg.getItems().clear();
            else pkg.setItems(new ArrayList<>());
        } else {
            pkg = PackageEntity.builder()
                    .name(req.getName())
                    .basePrice(req.getBasePrice())
                    .description(req.getDescription())
                    .items(new ArrayList<>())
                    .build();
        }
        for (PackageItemRequest it : req.getItems()) {
            PackageItemType type = PackageItemType.valueOf(it.getType());
            pkg.getItems().add(PackageItemEntity.builder()
                    .pkg(pkg)
                    .name(it.getName())
                    .type(type)
                    .cost(it.getCost())
                    .price(it.getPrice())
                    .included(it.getIncluded())
                    .build());
        }
        return packageRepo.save(pkg);
    }

    public List<AddonEntity> listAddons() {
        return addonRepo.findAll();
    }
}
