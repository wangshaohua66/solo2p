package com.wedding.suite.dto.response;

import com.wedding.suite.entity.*;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class SettingsVO {
    private List<StoreEntity> stores;
    private List<StaffEntity> staff;
    private List<VenueEntity> venues;
    private List<PropEntity> props;
    private List<AddonEntity> addons;
}
