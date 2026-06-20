package com.notarization.service.impl;

import com.notarization.dto.IntegrityVerifyResult;
import com.notarization.dto.request.EvidenceSubmitRequest;
import com.notarization.exception.BusinessException;
import com.notarization.exception.ErrorCode;
import com.notarization.model.EvidenceRecord;
import com.notarization.model.HashChain;
import com.notarization.model.enums.EvidenceType;
import com.notarization.repository.EvidenceRepository;
import com.notarization.repository.HashChainRepository;
import com.notarization.service.EvidenceHashService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvidenceHashServiceImpl implements EvidenceHashService {

    private static final String EVIDENCE_NUMBER_PREFIX = "EVID";
    private static final AtomicLong dailyEvidenceCounter = new AtomicLong(0);
    private static String lastEvidenceDatePrefix = "";

    private final EvidenceRepository evidenceRepository;
    private final HashChainRepository hashChainRepository;

    @Override
    @Transactional
    public EvidenceRecord submitEvidence(EvidenceSubmitRequest req) {
        String caseId = req.getCaseId();
        Instant now = Instant.now();
        long nowMillis = now.toEpochMilli();

        HashChain hashChain = hashChainRepository.findByCaseId(caseId).orElseGet(() -> {
            HashChain newChain = HashChain.builder()
                    .chainId(UUID.randomUUID().toString().replace("-", ""))
                    .caseId(caseId)
                    .genesisHash(sha256("GENESIS-" + caseId + "-" + nowMillis))
                    .build();
            newChain.setLastHash(newChain.getGenesisHash());
            newChain.setLength(0L);
            newChain.setLastUpdateTime(now);
            return hashChainRepository.save(newChain);
        });

        String prevHash = hashChain.getLastHash();
        Long hashIndex = hashChain.getLength() + 1;

        Instant trustedTimestamp = now;
        String currentHash = sha256(prevHash + "|" + req.getHash() + "|"
                + trustedTimestamp.toEpochMilli() + "|" + hashIndex);

        EvidenceRecord record = EvidenceRecord.builder()
                .evidenceNumber(generateEvidenceNumber())
                .caseId(caseId)
                .submitterId(req.getSubmitterId())
                .evidenceName(req.getEvidenceName())
                .evidenceType(mapEvidenceType(req.getEvidenceType()))
                .evidenceUrl(req.getEvidenceUrl())
                .fileHash(req.getHash())
                .description(req.getDescription())
                .hashIndex(hashIndex)
                .prevHash(prevHash)
                .currentHash(currentHash)
                .timestamp(trustedTimestamp)
                .chainId(hashChain.getChainId())
                .verified(false)
                .build();

        EvidenceRecord savedRecord = evidenceRepository.save(record);

        hashChain.setLastHash(currentHash);
        hashChain.setLength(hashIndex);
        hashChain.setLastUpdateTime(now);
        hashChainRepository.save(hashChain);

        log.info("Evidence submitted successfully, evidenceNumber: {}, chainId: {}, hashIndex: {}",
                savedRecord.getEvidenceNumber(), hashChain.getChainId(), hashIndex);

        return savedRecord;
    }

    @Override
    public IntegrityVerifyResult verifyIntegrity(String evidenceId) {
        Optional<EvidenceRecord> evidenceOpt = evidenceRepository.findById(evidenceId);
        if (evidenceOpt.isEmpty()) {
            return IntegrityVerifyResult.builder()
                    .valid(false)
                    .message("证据不存在: " + evidenceId)
                    .build();
        }

        EvidenceRecord evidenceRecord = evidenceOpt.get();
        String chainId = evidenceRecord.getChainId();

        Optional<HashChain> chainOpt = hashChainRepository.findByChainId(chainId);
        if (chainOpt.isEmpty()) {
            return IntegrityVerifyResult.builder()
                    .valid(false)
                    .message("哈希链不存在: " + chainId)
                    .chainId(chainId)
                    .build();
        }

        HashChain hashChain = chainOpt.get();
        List<EvidenceRecord> chainNodes = evidenceRepository.findByChainIdOrderByHashIndexAsc(chainId);

        String expected = hashChain.getGenesisHash();

        for (EvidenceRecord node : chainNodes) {
            String recalc = sha256(node.getPrevHash() + "|" + node.getFileHash() + "|"
                    + node.getTimestamp().toEpochMilli() + "|" + node.getHashIndex());

            if (!recalc.equals(node.getCurrentHash())) {
                return IntegrityVerifyResult.builder()
                        .valid(false)
                        .message("节点哈希校验失败，索引: " + node.getHashIndex())
                        .chainId(chainId)
                        .totalNodes((long) chainNodes.size())
                        .errorIndex(node.getHashIndex())
                        .expectedHash(recalc)
                        .actualHash(node.getCurrentHash())
                        .build();
            }

            if (!node.getPrevHash().equals(expected)) {
                return IntegrityVerifyResult.builder()
                        .valid(false)
                        .message("哈希链断裂，索引: " + node.getHashIndex())
                        .chainId(chainId)
                        .totalNodes((long) chainNodes.size())
                        .errorIndex(node.getHashIndex())
                        .expectedHash(expected)
                        .actualHash(node.getPrevHash())
                        .build();
            }

            expected = node.getCurrentHash();
        }

        if (!expected.equals(hashChain.getLastHash())) {
            return IntegrityVerifyResult.builder()
                    .valid(false)
                    .message("链尾哈希不匹配")
                    .chainId(chainId)
                    .totalNodes((long) chainNodes.size())
                    .expectedHash(hashChain.getLastHash())
                    .actualHash(expected)
                    .build();
        }

        return IntegrityVerifyResult.builder()
                .valid(true)
                .message("完整性校验通过，共验证 " + chainNodes.size() + " 个节点")
                .chainId(chainId)
                .totalNodes((long) chainNodes.size())
                .build();
    }

    @Override
    public HashChain getChain(String chainId) {
        return hashChainRepository.findByChainId(chainId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EVIDENCE_NOT_FOUND));
    }

    @Override
    public Optional<EvidenceRecord> findByEvidenceNumber(String number) {
        return evidenceRepository.findByEvidenceNumber(number);
    }

    @Override
    public Page<EvidenceRecord> findByCaseId(String caseId, Pageable pageable) {
        return evidenceRepository.findByCaseId(caseId, pageable);
    }

    private String sha256(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private synchronized String generateEvidenceNumber() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String currentPrefix = EVIDENCE_NUMBER_PREFIX + datePart;
        if (!currentPrefix.equals(lastEvidenceDatePrefix)) {
            lastEvidenceDatePrefix = currentPrefix;
            dailyEvidenceCounter.set(0);
        }
        long sequence = dailyEvidenceCounter.incrementAndGet();
        return currentPrefix + String.format("%08d", sequence);
    }

    private EvidenceType mapEvidenceType(String evidenceType) {
        if (evidenceType == null) {
            return EvidenceType.OTHER;
        }
        try {
            return EvidenceType.valueOf(evidenceType);
        } catch (IllegalArgumentException e) {
            return EvidenceType.OTHER;
        }
    }
}
