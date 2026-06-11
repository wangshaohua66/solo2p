package com.glassstudio.controller;

import com.glassstudio.dto.MemberCreateDTO;
import com.glassstudio.dto.MemberUpdateDTO;
import com.glassstudio.entity.Member;
import com.glassstudio.entity.MemberRole;
import com.glassstudio.entity.MemberRoleConfig;
import com.glassstudio.entity.WatchlistEntry;
import com.glassstudio.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ResponseEntity<Page<Member>> getAllMembers(@PageableDefault(size = 20) Pageable pageable) {
        Page<Member> members = memberService.getAllMembers(pageable);
        return ResponseEntity.ok(members);
    }

    @PostMapping
    public ResponseEntity<Member> createMember(@Valid @RequestBody MemberCreateDTO dto) {
        Member member = memberService.createMember(dto);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(member.getId())
                .toUri();
        return ResponseEntity.created(location).body(member);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Member> getMemberById(@PathVariable Long id) {
        Member member = memberService.getMemberById(id);
        return ResponseEntity.ok(member);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Member> updateMember(@PathVariable Long id, @Valid @RequestBody MemberUpdateDTO dto) {
        Member member = memberService.updateMember(id, dto);
        return ResponseEntity.ok(member);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMember(@PathVariable Long id) {
        memberService.deleteMember(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/watchlist")
    public ResponseEntity<List<WatchlistEntry>> getWatchlist() {
        List<WatchlistEntry> entries = memberService.getWatchlist();
        return ResponseEntity.ok(entries);
    }

    @GetMapping("/{id}/watchlist")
    public ResponseEntity<List<WatchlistEntry>> getMemberWatchlist(@PathVariable Long id) {
        List<WatchlistEntry> entries = memberService.getMemberWatchlist(id);
        return ResponseEntity.ok(entries);
    }

    @PostMapping("/{id}/watchlist")
    public ResponseEntity<WatchlistEntry> addToWatchlist(@PathVariable Long id, @RequestBody Map<String, Object> request) {
        String reason = (String) request.get("reason");
        Long incidentId = request.get("incidentId") != null ? Long.valueOf(request.get("incidentId").toString()) : null;
        Integer days = request.get("days") != null ? Integer.valueOf(request.get("days").toString()) : null;
        WatchlistEntry entry = memberService.addToWatchlist(id, reason, incidentId, days);
        return ResponseEntity.ok(entry);
    }

    @DeleteMapping("/{id}/watchlist")
    public ResponseEntity<Void> removeFromWatchlist(@PathVariable Long id) {
        memberService.removeFromWatchlist(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/role-configs")
    public ResponseEntity<List<MemberRoleConfig>> getAllRoleConfigs() {
        List<MemberRoleConfig> configs = memberService.getAllRoleConfigs();
        return ResponseEntity.ok(configs);
    }

    @GetMapping("/role-configs/{role}")
    public ResponseEntity<MemberRoleConfig> getRoleConfig(@PathVariable MemberRole role) {
        MemberRoleConfig config = memberService.getRoleConfigByRole(role);
        return ResponseEntity.ok(config);
    }

    @PostMapping("/role-configs")
    public ResponseEntity<MemberRoleConfig> saveRoleConfig(@RequestBody MemberRoleConfig config) {
        MemberRoleConfig saved = memberService.saveRoleConfig(config);
        return ResponseEntity.ok(saved);
    }
}
