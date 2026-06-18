package com.wedding.suite.service.impl;

import com.wedding.suite.dto.request.StoreSaveRequest;
import com.wedding.suite.dto.response.SettingsVO;
import com.wedding.suite.entity.StoreEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.AddonRepository;
import com.wedding.suite.repository.PropRepository;
import com.wedding.suite.repository.StaffRepository;
import com.wedding.suite.repository.StoreRepository;
import com.wedding.suite.repository.VenueRepository;
import org.springframework.stereotype.Service;

@Service
public class SettingsService {

    private final StoreRepository storeRepo;
    private final StaffRepository staffRepo;
    private final VenueRepository venueRepo;
    private final PropRepository propRepo;
    private final AddonRepository addonRepo;

    public SettingsService(StoreRepository storeRepo, StaffRepository staffRepo,
                           VenueRepository venueRepo, PropRepository propRepo,
                           AddonRepository addonRepo) {
        this.storeRepo = storeRepo;
        this.staffRepo = staffRepo;
        this.venueRepo = venueRepo;
        this.propRepo = propRepo;
        this.addonRepo = addonRepo;
    }

    public SettingsVO list() {
        return new SettingsVO(storeRepo.findAll(), staffRepo.findAll(), venueRepo.findAll(),
                propRepo.findAll(), addonRepo.findAll());
    }

    public StoreEntity saveStore(StoreSaveRequest req) {
        StoreEntity s;
        if (req.getId() != null) {
            s = storeRepo.findById(req.getId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "门店不存在"));
            s.setName(req.getName());
            s.setDiscountCoefficient(req.getDiscountCoefficient());
        } else {
            s = StoreEntity.builder()
                    .name(req.getName())
                    .discountCoefficient(req.getDiscountCoefficient())
                    .build();
        }
        return storeRepo.save(s);
    }
}
