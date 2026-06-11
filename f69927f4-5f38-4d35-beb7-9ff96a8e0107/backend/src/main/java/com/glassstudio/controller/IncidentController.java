package com.glassstudio.controller;

import com.glassstudio.annotation.RateLimit;
import com.glassstudio.dto.IncidentCreateDTO;
import com.glassstudio.dto.KilnOpenDTO;
import com.glassstudio.entity.Incident;
import com.glassstudio.entity.KilnOpenRecord;
import com.glassstudio.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    @GetMapping
    public ResponseEntity<List<Incident>> getAllIncidents() {
        List<Incident> incidents = incidentService.getAllIncidents();
        return ResponseEntity.ok(incidents);
    }

    @PostMapping
    public ResponseEntity<Incident> createIncident(@Valid @RequestBody IncidentCreateDTO dto) {
        Incident incident = incidentService.createIncident(dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(incident.getId())
                .toUri();
        return ResponseEntity.created(location).body(incident);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Incident> getIncidentById(@PathVariable Long id) {
        Incident incident = incidentService.getIncidentById(id);
        return ResponseEntity.ok(incident);
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<Incident> resolveIncident(@PathVariable Long id) {
        Incident incident = incidentService.resolveIncident(id);
        return ResponseEntity.ok(incident);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIncident(@PathVariable Long id) {
        incidentService.deleteIncident(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/kiln-opens")
    public ResponseEntity<List<KilnOpenRecord>> getAllKilnOpenRecords() {
        List<KilnOpenRecord> records = incidentService.getAllKilnOpenRecords();
        return ResponseEntity.ok(records);
    }

    @PostMapping("/kiln-opens")
    @RateLimit(key = "incident:kiln-opens", limit = 30, window = 60)
    public ResponseEntity<KilnOpenRecord> recordKilnOpen(@Valid @RequestBody KilnOpenDTO dto) {
        KilnOpenRecord record = incidentService.recordKilnOpen(dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(record.getId())
                .toUri();
        return ResponseEntity.created(location).body(record);
    }

    @GetMapping("/kiln-opens/{id}")
    public ResponseEntity<KilnOpenRecord> getKilnOpenRecordById(@PathVariable Long id) {
        KilnOpenRecord record = incidentService.getKilnOpenRecordById(id);
        return ResponseEntity.ok(record);
    }
}
