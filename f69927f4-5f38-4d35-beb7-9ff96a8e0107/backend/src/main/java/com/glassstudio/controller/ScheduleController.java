package com.glassstudio.controller;

import com.glassstudio.dto.ScheduleCreateDTO;
import com.glassstudio.dto.ScheduleUpdateDTO;
import com.glassstudio.entity.Schedule;
import com.glassstudio.entity.ScheduleStatus;
import com.glassstudio.service.KilnScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final KilnScheduleService kilnScheduleService;

    @GetMapping
    public ResponseEntity<Page<Schedule>> getSchedules(
            @RequestParam(required = false) Long kilnId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) ScheduleStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<Schedule> schedules = kilnScheduleService.getSchedules(kilnId, startDate, endDate, status, pageable);
        return ResponseEntity.ok(schedules);
    }

    @PostMapping
    public ResponseEntity<Schedule> createSchedule(@Valid @RequestBody ScheduleCreateDTO dto) {
        Schedule schedule = kilnScheduleService.createSchedule(dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(schedule.getId())
                .toUri();
        return ResponseEntity.created(location).body(schedule);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Schedule> getScheduleById(@PathVariable Long id) {
        Schedule schedule = kilnScheduleService.getScheduleById(id);
        return ResponseEntity.ok(schedule);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Schedule> updateSchedule(@PathVariable Long id, @Valid @RequestBody ScheduleUpdateDTO dto) {
        Schedule schedule = kilnScheduleService.updateSchedule(id, dto);
        return ResponseEntity.ok(schedule);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long id) {
        kilnScheduleService.deleteSchedule(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/override")
    public ResponseEntity<Schedule> overrideSchedule(@PathVariable Long id, @RequestBody Map<String, String> request) {
        String reason = request.get("reason");
        Schedule schedule = kilnScheduleService.overrideSchedule(id, reason);
        return ResponseEntity.ok(schedule);
    }

    @GetMapping("/conflicts")
    public ResponseEntity<List<Schedule>> checkConflicts(
            @RequestParam Long kilnId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        List<Schedule> conflicts = kilnScheduleService.checkConflict(kilnId, startTime, endTime);
        return ResponseEntity.ok(conflicts);
    }
}
