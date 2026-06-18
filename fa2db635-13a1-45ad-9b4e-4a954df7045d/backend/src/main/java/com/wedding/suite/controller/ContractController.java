package com.wedding.suite.controller;

import com.wedding.suite.dto.ApiResponse;
import com.wedding.suite.dto.request.ContractDraftRequest;
import com.wedding.suite.dto.request.ContractSignRequest;
import com.wedding.suite.dto.request.ContractUpdateRequest;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.service.SignService;
import com.wedding.suite.service.impl.ContractService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/contracts")
public class ContractController {

    private final ContractService contractService;
    private final SignService signService;

    public ContractController(ContractService contractService, SignService signService) {
        this.contractService = contractService;
        this.signService = signService;
    }

    @GetMapping
    public ApiResponse<List<ContractEntity>> list(@RequestParam(required = false) String status) {
        return ApiResponse.ok(contractService.list(status));
    }

    @GetMapping("/{id}")
    public ApiResponse<ContractEntity> detail(@PathVariable Long id) {
        return ApiResponse.ok(contractService.detail(id));
    }

    @PostMapping("/draft")
    public ApiResponse<ContractEntity> draft(@Valid @RequestBody ContractDraftRequest req) {
        return ApiResponse.ok(contractService.draft(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<ContractEntity> update(@PathVariable Long id,
                                              @Valid @RequestBody ContractUpdateRequest req) {
        return ApiResponse.ok(contractService.update(id, req));
    }

    @PostMapping("/{id}/sign")
    public ApiResponse<ContractEntity> sign(@PathVariable Long id,
                                           @Valid @RequestBody ContractSignRequest req) {
        return ApiResponse.ok(contractService.sign(id, req));
    }

    @PostMapping("/{id}/void")
    public ApiResponse<ContractEntity> voidContract(@PathVariable Long id) {
        return ApiResponse.ok(contractService.voidContract(id));
    }

    @GetMapping("/{id}/sign-status")
    public ApiResponse<SignResultVO> querySignStatus(@PathVariable Long id,
                                                      @RequestParam(required = false) String flowId) {
        com.wedding.suite.entity.ContractEntity c = contractService.detail(id);
        String fid = (flowId != null && !flowId.isBlank()) ? flowId : c.getFlowId();
        SignResultVO result = signService.queryStatus(fid);
        if ("SIGNED".equals(result.getStatus())) {
            contractService.markSigned(id);
        }
        return ApiResponse.ok(result);
    }

    @GetMapping("/{id}/signed-file")
    public ApiResponse<String> downloadSignedFile(@PathVariable Long id,
                                                   @RequestParam(required = false) String flowId) {
        com.wedding.suite.entity.ContractEntity c = contractService.detail(id);
        String fid = (flowId != null && !flowId.isBlank()) ? flowId : c.getFlowId();
        return ApiResponse.ok(signService.downloadSignedFileUrl(fid));
    }
}
