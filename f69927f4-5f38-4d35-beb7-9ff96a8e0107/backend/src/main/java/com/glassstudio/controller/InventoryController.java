package com.glassstudio.controller;

import com.glassstudio.dto.BatchCreateDTO;
import com.glassstudio.entity.Batch;
import com.glassstudio.service.InventoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/inventories")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/batches")
    public ResponseEntity<List<Batch>> getAllBatches() {
        List<Batch> batches = inventoryService.getAllBatches();
        return ResponseEntity.ok(batches);
    }

    @PostMapping("/batches")
    public ResponseEntity<Batch> createBatch(@Valid @RequestBody BatchCreateDTO dto) {
        Batch batch = inventoryService.createBatch(dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(batch.getId())
                .toUri();
        return ResponseEntity.created(location).body(batch);
    }

    @GetMapping("/batches/{id}")
    public ResponseEntity<Batch> getBatchById(@PathVariable Long id) {
        Batch batch = inventoryService.getBatchById(id);
        return ResponseEntity.ok(batch);
    }

    @DeleteMapping("/batches/{id}")
    public ResponseEntity<Void> deleteBatch(@PathVariable Long id) {
        inventoryService.deleteBatch(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/batches/{id}/checkout")
    public ResponseEntity<Batch> checkoutBatch(@PathVariable Long id, @RequestBody Map<String, BigDecimal> request) {
        BigDecimal quantity = request.get("quantity");
        Batch batch = inventoryService.checkoutBatch(id, quantity);
        return ResponseEntity.ok(batch);
    }

    @PostMapping("/batches/checkout-fifo")
    public ResponseEntity<Batch> fifoCheckout(@RequestBody Map<String, Object> request) {
        String materialName = (String) request.get("materialName");
        BigDecimal quantity = new BigDecimal(request.get("quantity").toString());
        Batch batch = inventoryService.fifoCheckout(materialName, quantity);
        return ResponseEntity.ok(batch);
    }

    @GetMapping("/warnings")
    public ResponseEntity<List<Batch>> getExpiryWarnings() {
        List<Batch> warnings = inventoryService.getExpiryWarnings();
        return ResponseEntity.ok(warnings);
    }

    @GetMapping("/batches/{id}/oxide-composition")
    public ResponseEntity<Map<String, Object>> getOxideComposition(@PathVariable Long id) {
        Map<String, Object> composition = inventoryService.getOxideComposition(id);
        return ResponseEntity.ok(composition);
    }
}
