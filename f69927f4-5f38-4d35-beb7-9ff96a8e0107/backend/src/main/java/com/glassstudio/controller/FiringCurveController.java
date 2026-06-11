package com.glassstudio.controller;

import com.glassstudio.dto.CurveCreateDTO;
import com.glassstudio.dto.CurveUpdateDTO;
import com.glassstudio.entity.FiringCurve;
import com.glassstudio.service.FiringCurveService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
    public ResponseEntity<Page<FiringCurve>> getAllCurves(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean isTemplate,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<FiringCurve> curves = firingCurveService.getAllCurves(keyword, isTemplate, pageable);
        return ResponseEntity.ok(curves);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','ARTIST')")
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
    @PreAuthorize("hasAnyRole('ADMIN','ARTIST')")
    public ResponseEntity<FiringCurve> updateCurve(@PathVariable Long id, @Valid @RequestBody CurveUpdateDTO dto) {
        FiringCurve curve = firingCurveService.updateCurve(id, dto);
        return ResponseEntity.ok(curve);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ARTIST')")
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
    @PreAuthorize("hasAnyRole('ADMIN','ARTIST')")
    public ResponseEntity<FiringCurve> duplicateCurve(
            @PathVariable Long id,
            @RequestParam(required = false) String name) {
        FiringCurve curve = firingCurveService.duplicateCurve(id, 1L, name);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .replacePath("/api/v1/curves/{id}")
                .buildAndExpand(curve.getId())
                .toUri();
        return ResponseEntity.created(location).body(curve);
    }
}
