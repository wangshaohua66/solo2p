package com.glassstudio.service;

import com.glassstudio.dto.MemberCreateDTO;
import com.glassstudio.dto.MemberUpdateDTO;
import com.glassstudio.entity.*;
import com.glassstudio.exception.ConflictException;
import com.glassstudio.exception.NotFoundException;
import com.glassstudio.mapper.MemberMapper;
import com.glassstudio.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final MemberMapper memberMapper;
    private final PasswordEncoder passwordEncoder;
    private final WatchlistEntryRepository watchlistEntryRepository;
    private final MemberRoleConfigRepository memberRoleConfigRepository;

    public Page<Member> getAllMembers(Pageable pageable) {
        return memberRepository.findAll(pageable);
    }

    public Member getMemberById(Long id) {
        return memberRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("会员不存在"));
    }

    @Transactional
    public Member createMember(MemberCreateDTO dto) {
        if (memberRepository.existsByUsername(dto.getUsername())) {
            throw new ConflictException("用户名已存在");
        }

        Member member = memberMapper.toEntity(dto);
        member.setPasswordHash(passwordEncoder.encode("123456"));
        member.setStatus(MemberStatus.ACTIVE);

        return memberRepository.save(member);
    }

    @Transactional
    public Member updateMember(Long id, MemberUpdateDTO dto) {
        Member member = getMemberById(id);
        memberMapper.updateEntity(dto, member);
        return memberRepository.save(member);
    }

    @Transactional
    public void deleteMember(Long id) {
        if (!memberRepository.existsById(id)) {
            throw new NotFoundException("会员不存在");
        }
        memberRepository.deleteById(id);
    }

    public List<WatchlistEntry> getWatchlist() {
        return watchlistEntryRepository.findAll();
    }

    public List<WatchlistEntry> getMemberWatchlist(Long memberId) {
        return watchlistEntryRepository.findByMemberId(memberId);
    }

    @Transactional
    public WatchlistEntry addToWatchlist(Long memberId, String reason, Long incidentId, Integer days) {
        Member member = getMemberById(memberId);

        WatchlistEntry entry = WatchlistEntry.builder()
                .memberId(memberId)
                .reason(reason)
                .incidentId(incidentId)
                .watchUntil(days != null ? LocalDateTime.now().plusDays(days) : null)
                .build();

        member.setStatus(MemberStatus.WATCHLIST);
        memberRepository.save(member);

        return watchlistEntryRepository.save(entry);
    }

    @Transactional
    public void removeFromWatchlist(Long memberId) {
        Member member = getMemberById(memberId);
        member.setStatus(MemberStatus.ACTIVE);
        memberRepository.save(member);
    }

    public List<MemberRoleConfig> getAllRoleConfigs() {
        return memberRoleConfigRepository.findAll();
    }

    public MemberRoleConfig getRoleConfigByRole(MemberRole role) {
        return memberRoleConfigRepository.findByRole(role)
                .orElseThrow(() -> new NotFoundException("角色配置不存在"));
    }

    @Transactional
    public MemberRoleConfig saveRoleConfig(MemberRoleConfig config) {
        return memberRoleConfigRepository.save(config);
    }
}
