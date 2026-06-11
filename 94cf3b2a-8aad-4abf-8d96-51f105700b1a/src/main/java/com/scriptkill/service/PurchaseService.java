package com.scriptkill.service;

import com.scriptkill.dto.common.PageResult;
import com.scriptkill.dto.purchase.PurchaseCreateRequest;
import com.scriptkill.dto.purchase.PurchaseResponse;
import com.scriptkill.dto.purchase.PurchaseReviewRequest;
import com.scriptkill.entity.Purchase;
import com.scriptkill.entity.Script;
import com.scriptkill.entity.User;
import com.scriptkill.entity.enums.PurchaseStatus;
import com.scriptkill.entity.enums.ScriptDifficulty;
import com.scriptkill.entity.enums.ScriptGenre;
import com.scriptkill.exception.BusinessException;
import com.scriptkill.repository.PurchaseRepository;
import com.scriptkill.repository.ScriptRepository;
import com.scriptkill.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseService {

    private final PurchaseRepository purchaseRepository;
    private final UserRepository userRepository;
    private final ScriptRepository scriptRepository;

    private static final int REQUIRED_REVIEWERS = 3;
    private static final int DEFAULT_PASSING_SCORE = 60;

    public PurchaseService(PurchaseRepository purchaseRepository,
                           UserRepository userRepository,
                           ScriptRepository scriptRepository) {
        this.purchaseRepository = purchaseRepository;
        this.userRepository = userRepository;
        this.scriptRepository = scriptRepository;
    }

    @Transactional
    public PurchaseResponse submitPurchase(PurchaseCreateRequest request, Long submitterId) {
        User submitter = userRepository.findById(submitterId)
                .orElseThrow(() -> new BusinessException("提交人不存在"));

        Purchase purchase = new Purchase();
        purchase.setScriptName(request.getScriptName());
        purchase.setScriptDescription(request.getScriptDescription());
        purchase.setAuthor(request.getAuthor());
        purchase.setPublisher(request.getPublisher());
        purchase.setPlayerCount(request.getPlayerCount());
        purchase.setEstimatedDuration(request.getEstimatedDuration());
        purchase.setGenre(request.getGenre());
        purchase.setDifficulty(request.getDifficulty());
        purchase.setPurchasePrice(request.getPurchasePrice());
        purchase.setSampleContent(request.getSampleContent());
        purchase.setStatus(PurchaseStatus.PENDING_REVIEW);
        purchase.setSubmitter(submitter);
        purchase.setPassingScore(DEFAULT_PASSING_SCORE);
        purchase.setNotes(request.getNotes());

        purchase = purchaseRepository.save(purchase);

        return convertToResponse(purchase);
    }

    @Transactional
    public PurchaseResponse reviewPurchase(PurchaseReviewRequest request, Long reviewerId) {
        Purchase purchase = purchaseRepository.findById(request.getPurchaseId())
                .orElseThrow(() -> new BusinessException("采购评审不存在"));

        if (purchase.getStatus() != PurchaseStatus.PENDING_REVIEW) {
            throw new BusinessException("该评审已完成，不可重复评审");
        }

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new BusinessException("评审人不存在"));

        if (reviewer.getRole() != com.scriptkill.entity.enums.Role.DM) {
            throw new BusinessException("只有DM角色可以参与本子评审");
        }

        assignReview(purchase, reviewerId, request.getScore(), request.getComment());

        if (isAllReviewed(purchase)) {
            double averageScore = calculateAverageScore(purchase);
            purchase.setAverageScore(Math.round(averageScore * 10.0) / 10.0);

            if (averageScore >= purchase.getPassingScore()) {
                purchase.setStatus(PurchaseStatus.APPROVED);
                Script script = createScriptFromPurchase(purchase);
                purchase.setResultScriptId(script.getId());
            } else {
                purchase.setStatus(PurchaseStatus.CANDIDATE_POOL);
            }
        }

        purchase = purchaseRepository.save(purchase);

        return convertToResponse(purchase);
    }

    private void assignReview(Purchase purchase, Long reviewerId, Integer score, String comment) {
        if (purchase.getReviewer1Id() == null) {
            purchase.setReviewer1Id(reviewerId);
            purchase.setReviewer1Score(score);
            purchase.setReviewer1Comment(comment);
        } else if (purchase.getReviewer2Id() == null && !purchase.getReviewer1Id().equals(reviewerId)) {
            purchase.setReviewer2Id(reviewerId);
            purchase.setReviewer2Score(score);
            purchase.setReviewer2Comment(comment);
        } else if (purchase.getReviewer3Id() == null &&
                !purchase.getReviewer1Id().equals(reviewerId) &&
                !purchase.getReviewer2Id().equals(reviewerId)) {
            purchase.setReviewer3Id(reviewerId);
            purchase.setReviewer3Score(score);
            purchase.setReviewer3Comment(comment);
        } else {
            throw new BusinessException("您已经评审过或评审人数已满");
        }
    }

    private boolean isAllReviewed(Purchase purchase) {
        return purchase.getReviewer1Id() != null &&
                purchase.getReviewer2Id() != null &&
                purchase.getReviewer3Id() != null;
    }

    private double calculateAverageScore(Purchase purchase) {
        int total = 0;
        int count = 0;

        if (purchase.getReviewer1Score() != null) {
            total += purchase.getReviewer1Score();
            count++;
        }
        if (purchase.getReviewer2Score() != null) {
            total += purchase.getReviewer2Score();
            count++;
        }
        if (purchase.getReviewer3Score() != null) {
            total += purchase.getReviewer3Score();
            count++;
        }

        return count > 0 ? (double) total / count : 0.0;
    }

    private Script createScriptFromPurchase(Purchase purchase) {
        Script script = new Script();
        script.setName(purchase.getScriptName());
        script.setDescription(purchase.getScriptDescription());

        String playerCountStr = purchase.getPlayerCount();
        if (playerCountStr != null && playerCountStr.contains("-")) {
            String[] parts = playerCountStr.replaceAll("[^0-9\\-]", "").split("-");
            if (parts.length == 2) {
                script.setMinPlayers(Integer.parseInt(parts[0]));
                script.setMaxPlayers(Integer.parseInt(parts[1]));
            } else {
                script.setMinPlayers(5);
                script.setMaxPlayers(8);
            }
        } else {
            script.setMinPlayers(5);
            script.setMaxPlayers(8);
        }

        String durationStr = purchase.getEstimatedDuration();
        if (durationStr != null) {
            try {
                script.setEstimatedDurationMinutes(Integer.parseInt(
                        durationStr.replaceAll("[^0-9]", "")));
            } catch (Exception e) {
                script.setEstimatedDurationMinutes(240);
            }
        } else {
            script.setEstimatedDurationMinutes(240);
        }

        try {
            if (purchase.getGenre() != null && !purchase.getGenre().isEmpty()) {
                script.setGenre(ScriptGenre.valueOf(purchase.getGenre()));
            } else {
                script.setGenre(ScriptGenre.REASONING);
            }
        } catch (Exception e) {
            script.setGenre(ScriptGenre.REASONING);
        }

        try {
            if (purchase.getDifficulty() != null && !purchase.getDifficulty().isEmpty()) {
                script.setDifficulty(ScriptDifficulty.valueOf(purchase.getDifficulty()));
            } else {
                script.setDifficulty(ScriptDifficulty.NORMAL);
            }
        } catch (Exception e) {
            script.setDifficulty(ScriptDifficulty.NORMAL);
        }

        script.setStatus("ACTIVE");
        script.setVersion(1);

        return scriptRepository.save(script);
    }

    @Transactional(readOnly = true)
    public PageResult<PurchaseResponse> listPurchases(int page, int size, String status) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Purchase> purchasePage;

        if (status != null && !status.isEmpty()) {
            purchasePage = purchaseRepository.findByStatus(
                    PurchaseStatus.valueOf(status), pageable);
        } else {
            purchasePage = purchaseRepository.findAll(pageable);
        }

        var content = purchasePage.getContent().stream()
                .map(this::convertToResponse)
                .toList();

        return new PageResult<>(
                content,
                purchasePage.getNumber(),
                purchasePage.getSize(),
                purchasePage.getTotalElements(),
                purchasePage.getTotalPages(),
                purchasePage.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public PurchaseResponse getPurchaseDetail(Long id) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new BusinessException("采购评审不存在"));
        return convertToResponse(purchase);
    }

    @Transactional
    public PurchaseResponse rejectPurchase(Long id, String reason) {
        Purchase purchase = purchaseRepository.findById(id)
                .orElseThrow(() -> new BusinessException("采购评审不存在"));

        if (purchase.getStatus() != PurchaseStatus.PENDING_REVIEW) {
            throw new BusinessException("当前状态不可拒绝");
        }

        purchase.setStatus(PurchaseStatus.REJECTED);
        purchase.setNotes(reason);

        purchase = purchaseRepository.save(purchase);
        return convertToResponse(purchase);
    }

    private PurchaseResponse convertToResponse(Purchase purchase) {
        PurchaseResponse response = new PurchaseResponse();
        response.setId(purchase.getId());
        response.setScriptName(purchase.getScriptName());
        response.setScriptDescription(purchase.getScriptDescription());
        response.setAuthor(purchase.getAuthor());
        response.setPublisher(purchase.getPublisher());
        response.setPlayerCount(purchase.getPlayerCount());
        response.setEstimatedDuration(purchase.getEstimatedDuration());
        response.setGenre(purchase.getGenre());
        response.setDifficulty(purchase.getDifficulty());
        response.setPurchasePrice(purchase.getPurchasePrice());
        response.setSampleContent(purchase.getSampleContent());
        response.setStatus(purchase.getStatus().name());

        if (purchase.getSubmitter() != null) {
            response.setSubmitterId(purchase.getSubmitter().getId());
            response.setSubmitterName(purchase.getSubmitter().getNickname());
        }

        response.setReviewer1Id(purchase.getReviewer1Id());
        response.setReviewer1Score(purchase.getReviewer1Score());
        response.setReviewer1Comment(purchase.getReviewer1Comment());
        response.setReviewer2Id(purchase.getReviewer2Id());
        response.setReviewer2Score(purchase.getReviewer2Score());
        response.setReviewer2Comment(purchase.getReviewer2Comment());
        response.setReviewer3Id(purchase.getReviewer3Id());
        response.setReviewer3Score(purchase.getReviewer3Score());
        response.setReviewer3Comment(purchase.getReviewer3Comment());
        response.setAverageScore(purchase.getAverageScore());
        response.setPassingScore(purchase.getPassingScore());
        response.setResultScriptId(purchase.getResultScriptId());
        response.setNotes(purchase.getNotes());
        response.setCreatedAt(purchase.getCreatedAt());
        response.setUpdatedAt(purchase.getUpdatedAt());
        return response;
    }
}
