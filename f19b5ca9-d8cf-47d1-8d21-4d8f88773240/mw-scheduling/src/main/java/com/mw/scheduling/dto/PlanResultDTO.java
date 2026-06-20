package com.mw.scheduling.dto;

import com.mw.scheduling.document.DispatchOrder;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlanResultDTO {

    private List<DispatchOrder> orders;
    private int assignedNodes;
    private int unassignedNodes;
    private double totalDistanceKm;
}
