package com.glassstudio.controller;

import com.glassstudio.dto.MaintenanceCreateDTO;
import com.glassstudio.entity.Kiln;
import com.glassstudio.entity.MaintenanceOrder;
import com.glassstudio.service.EquipmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/equipments")
@RequiredArgsConstructor
public class EquipmentController {

    private final EquipmentService equipmentService;

    @GetMapping("/kilns")
    public ResponseEntity<List<Kiln>> getAllKilns() {
        List<Kiln> kilns = equipmentService.getAllKilns();
        return ResponseEntity.ok(kilns);
    }

    @PostMapping("/kilns")
    public ResponseEntity<Kiln> createKiln(@RequestBody Kiln kiln) {
        Kiln created = equipmentService.createKiln(kiln);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.getId())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    @GetMapping("/kilns/{id}")
    public ResponseEntity<Kiln> getKilnById(@PathVariable Long id) {
        Kiln kiln = equipmentService.getKilnById(id);
        return ResponseEntity.ok(kiln);
    }

    @PutMapping("/kilns/{id}")
    public ResponseEntity<Kiln> updateKiln(@PathVariable Long id, @RequestBody Kiln kiln) {
        Kiln updated = equipmentService.updateKiln(id, kiln);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/kilns/{id}")
    public ResponseEntity<Void> deleteKiln(@PathVariable Long id) {
        equipmentService.deleteKiln(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/kilns/{id}/health-check")
    public ResponseEntity<Kiln> updateHealthStatus(@PathVariable Long id) {
        Kiln kiln = equipmentService.updateKilnHealthStatus(id);
        return ResponseEntity.ok(kiln);
    }

    @GetMapping("/kilns/{kilnId}/maintenance")
    public ResponseEntity<List<MaintenanceOrder>> getMaintenanceOrders(@PathVariable Long kilnId) {
        List<MaintenanceOrder> orders = equipmentService.getMaintenanceOrders(kilnId);
        return ResponseEntity.ok(orders);
    }

    @PostMapping("/kilns/{kilnId}/maintenance")
    public ResponseEntity<MaintenanceOrder> createMaintenanceOrder(
            @PathVariable Long kilnId,
            @Valid @RequestBody MaintenanceCreateDTO dto) {
        MaintenanceOrder order = equipmentService.createMaintenanceOrder(kilnId, dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(order.getId())
                .toUri();
        return ResponseEntity.created(location).body(order);
    }

    @PostMapping("/kilns/maintenance/{id}/start")
    public ResponseEntity<MaintenanceOrder> startMaintenance(@PathVariable Long id) {
        MaintenanceOrder order = equipmentService.startMaintenance(id);
        return ResponseEntity.ok(order);
    }

    @PostMapping("/kilns/maintenance/{id}/complete")
    public ResponseEntity<MaintenanceOrder> completeMaintenance(@PathVariable Long id) {
        MaintenanceOrder order = equipmentService.completeMaintenance(id);
        return ResponseEntity.ok(order);
    }

    @DeleteMapping("/kilns/maintenance/{id}")
    public ResponseEntity<Void> deleteMaintenanceOrder(@PathVariable Long id) {
        equipmentService.deleteMaintenanceOrder(id);
        return ResponseEntity.noContent().build();
    }
}
