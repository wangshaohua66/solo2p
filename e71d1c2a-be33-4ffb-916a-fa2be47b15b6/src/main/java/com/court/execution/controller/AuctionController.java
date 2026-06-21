package com.court.execution.controller;

import com.court.execution.common.ApiResponse;
import com.court.execution.entity.Auction;
import com.court.execution.entity.AuctionStatus;
import com.court.execution.entity.BidRecord;
import com.court.execution.service.AuctionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/auctions")
@Tag(name = "评估拍卖管理", description = "评估委托、拍卖公告、竞价记录、成交确认等拍卖流程接口")
public class AuctionController {

    private final AuctionService auctionService;

    public AuctionController(AuctionService auctionService) {
        this.auctionService = auctionService;
    }

    @PostMapping("/evaluation")
    @Operation(summary = "创建评估委托", description = "指定评估机构、上传评估报告")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'JUDGE', 'ADMIN')")
    public ApiResponse<Auction> createEvaluation(
            @Parameter(description = "财产ID", required = true) @RequestParam Long propertyId,
            @Parameter(description = "评估机构名称") @RequestParam(required = false) String evaluationAgency,
            @Parameter(description = "评估价格") @RequestParam(required = false) BigDecimal evaluationPrice) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String username = auth.getName();
        Auction auction = auctionService.createEvaluation(propertyId, evaluationAgency, evaluationPrice, username);
        return ApiResponse.success("评估委托创建成功", auction);
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取拍卖详情")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Auction> getAuctionById(@PathVariable Long id) {
        Auction auction = auctionService.getAuctionById(id);
        return ApiResponse.success(auction);
    }

    @GetMapping("/case/{caseId}")
    @Operation(summary = "获取案件拍卖列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<Auction>> getAuctionsByCaseId(@PathVariable Long caseId) {
        List<Auction> auctions = auctionService.getAuctionsByCaseId(caseId);
        return ApiResponse.success(auctions);
    }

    @GetMapping("/property/{propertyId}")
    @Operation(summary = "获取财产拍卖列表")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<Auction>> getAuctionsByPropertyId(@PathVariable Long propertyId) {
        List<Auction> auctions = auctionService.getAuctionsByPropertyId(propertyId);
        return ApiResponse.success(auctions);
    }

    @GetMapping("/status/{status}")
    @Operation(summary = "按状态查询拍卖")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Page<Auction>> getAuctionsByStatus(
            @PathVariable AuctionStatus status,
            @Parameter(description = "页码") @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "每页大小") @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createTime"));
        Page<Auction> auctions = auctionService.getAuctionsByStatus(status, pageable);
        return ApiResponse.success(auctions);
    }

    @PostMapping("/{id}/publish")
    @Operation(summary = "发布拍卖公告", description = "发布至指定拍卖平台、设定竞价规则")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'JUDGE', 'ADMIN')")
    public ApiResponse<Auction> publishAuction(
            @PathVariable Long id,
            @Parameter(description = "拍卖平台", required = true) @RequestParam String auctionPlatform,
            @Parameter(description = "起拍价", required = true) @RequestParam BigDecimal startingPrice,
            @Parameter(description = "保留价") @RequestParam(required = false) BigDecimal reservePrice,
            @Parameter(description = "加价幅度", required = true) @RequestParam BigDecimal bidIncrement,
            @Parameter(description = "开始时间", required = true) @RequestParam LocalDateTime startTime,
            @Parameter(description = "结束时间", required = true) @RequestParam LocalDateTime endTime) {
        Auction auction = auctionService.publishAuction(id, auctionPlatform, startingPrice,
                reservePrice, bidIncrement, startTime, endTime);
        return ApiResponse.success("拍卖公告已发布", auction);
    }

    @PostMapping("/{id}/start")
    @Operation(summary = "开始竞价")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'JUDGE', 'ADMIN')")
    public ApiResponse<Auction> startBidding(@PathVariable Long id) {
        Auction auction = auctionService.startBidding(id);
        return ApiResponse.success("竞价已开始", auction);
    }

    @PostMapping("/{id}/bid")
    @Operation(summary = "出价竞买", description = "记录每次出价时间、金额、竞买人")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<BidRecord> placeBid(
            @PathVariable Long id,
            @Parameter(description = "出价金额", required = true) @RequestParam BigDecimal bidAmount,
            @Parameter(description = "竞买人姓名", required = true) @RequestParam String bidderName,
            @Parameter(description = "竞买人身份证号") @RequestParam(required = false) String bidderIdCard,
            @Parameter(description = "竞买人电话") @RequestParam(required = false) String bidderPhone) {
        BidRecord bid = auctionService.placeBid(id, bidAmount, bidderName, bidderIdCard, bidderPhone);
        return ApiResponse.success("出价成功", bid);
    }

    @GetMapping("/{id}/bids")
    @Operation(summary = "获取竞价记录")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<List<BidRecord>> getBidRecords(@PathVariable Long id) {
        List<BidRecord> bids = auctionService.getBidRecords(id);
        return ApiResponse.success(bids);
    }

    @GetMapping("/{id}/highest-bid")
    @Operation(summary = "获取最高出价")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<BidRecord> getHighestBid(@PathVariable Long id) {
        BidRecord bid = auctionService.getHighestBid(id);
        return ApiResponse.success(bid);
    }

    @PostMapping("/{id}/close")
    @Operation(summary = "结束拍卖", description = "生成成交裁定书、记录成交价款；无人出价则流拍")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'JUDGE', 'ADMIN')")
    public ApiResponse<Auction> closeAuction(@PathVariable Long id) {
        Auction auction = auctionService.closeAuction(id);
        return ApiResponse.success("拍卖已结束", auction);
    }

    @PostMapping("/{id}/withdraw")
    @Operation(summary = "撤回拍卖")
    @PreAuthorize("hasAnyRole('JUDGE', 'ADMIN')")
    public ApiResponse<Auction> withdrawAuction(
            @PathVariable Long id,
            @Parameter(description = "撤回原因") @RequestParam String reason) {
        Auction auction = auctionService.withdrawAuction(id, reason);
        return ApiResponse.success("拍卖已撤回", auction);
    }

    @PutMapping("/{id}/evaluation-report")
    @Operation(summary = "更新评估报告")
    @PreAuthorize("hasAnyRole('AUCTION_SPECIALIST', 'JUDGE', 'ADMIN')")
    public ApiResponse<Auction> updateEvaluationReport(
            @PathVariable Long id,
            @Parameter(description = "评估报告URL") @RequestParam String reportUrl) {
        Auction auction = auctionService.updateEvaluationReport(id, reportUrl);
        return ApiResponse.success("评估报告已更新", auction);
    }

    @GetMapping("/{id}/bid-count")
    @Operation(summary = "获取出价次数")
    @PreAuthorize("hasAnyRole('JUDGE', 'ASSISTANT', 'AUCTION_SPECIALIST', 'ADMIN')")
    public ApiResponse<Long> getBidCount(@PathVariable Long id) {
        long count = auctionService.getBidCount(id);
        return ApiResponse.success(count);
    }
}
