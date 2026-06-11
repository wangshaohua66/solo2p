package com.glassstudio.controller;

import com.glassstudio.dto.CurveCreateDTO;
import com.glassstudio.dto.CurveUpdateDTO;
import com.glassstudio.entity.FiringCurve;
import com.glassstudio.service.FiringCurveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/curves")
@RequiredArgsConstructor
public class FiringCurveController {

    private final FiringCurveService firingCurveService;

    @GetMapping
    public ResponseEntity<List<FiringCurve>> getAllCurves() {
        List<FiringCurve> curves = firingCurveService.getAllCurves();
        return ResponseEntity.ok(curves);
    }

    @PostMapping
    public ResponseEntity<FiringCurve> createCurve(@Valid @RequestBody CurveCreateDTO dto) {
        FiringCurve curve = firingCurveService.createCurve(dto, 1L);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(curve.getId())
                .toUri();
        return ResponseEntity.created(location).body(curve);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FiringCurve> getCurveById(@PathVariable Long id) {
        FiringCurve curve = firingCurveService.getCurveById(id);
        return ResponseEntity.ok(curve);
    }

    @PutMapping("/{id}")
    public ResponseEntity<FiringCurve> updateCurve(@PathVariable Long id, @Valid @RequestBody CurveUpdateDTO dto) {
        FiringCurve curve = firingCurveService.updateCurve(id, dto);
        return ResponseEntity.ok(curve);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCurve(@PathVariable Long id) {
        firingCurveService.deleteCurve(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/templates")
    public ResponseEntity<List<FiringCurve>> getTemplates() {
        List<FiringCurve> templates = firingCurveService.getTemplates();
        return ResponseEntity.ok(templates);
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<FiringCurve> duplicateCurve(@PathVariable Long id) {
        FiringCurve curve = firingCurveService.duplicateCurve(id, 1L);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(curve.getId())
                .toUri();
        return ResponseEntity.created(location).body(curve);
    }
}
