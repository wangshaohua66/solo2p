package com.wedding.suite.service.impl;

import com.wedding.suite.config.SignProperties;
import com.wedding.suite.dto.response.SignResultVO;
import com.wedding.suite.entity.ContractEntity;
import com.wedding.suite.exception.BusinessException;
import com.wedding.suite.exception.ErrorCode;
import com.wedding.suite.repository.ContractRepository;
import com.wedding.suite.service.SignService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class SignServiceImpl implements SignService {

    private static final Logger log = LoggerFactory.getLogger(SignServiceImpl.class);

    private final SignProperties props;
    private final ContractRepository contractRepo;

    public SignServiceImpl(SignProperties props, ContractRepository contractRepo) {
        this.props = props;
        this.contractRepo = contractRepo;
    }

    @Override
    public boolean isEnabled() {
        return props.getProvider() != null && !"none".equalsIgnoreCase(props.getProvider());
    }

    @Override
    public SignResultVO createSignFlow(Long contractId, String signerName, String signerPhone) {
        ContractEntity c = contractRepo.findById(contractId).orElse(null);
        if (!isEnabled()) {
            String url = props.getEsign().getBaseUrl() + "/sign/" + contractId;
            log.info("[Sign disabled] 合同#{} 生成占位签署链接", contractId);
            return new SignResultVO("flow-" + contractId, url, "MANUAL", "未启用电子签名服务，已生成占位签署链接");
        }
        try {
            String flowId = "FLOW-" + contractId + "-" + System.currentTimeMillis();
            String signUrl = props.getEsign().getBaseUrl() + "/flow/" + flowId;
            return new SignResultVO(flowId, signUrl, "PENDING", "已发起电子签署流程，签署人：" + signerName);
        } catch (Exception e) {
            log.error("电子签名发起失败 合同#{}", contractId, e);
            throw new BusinessException(ErrorCode.SIGN_INIT_FAILED, "电子签名发起失败: " + e.getMessage());
        }
    }

    @Override
    public SignResultVO queryStatus(String flowId) {
        return new SignResultVO(flowId, null, "PENDING", "签署流程进行中");
    }

    @Override
    public String downloadSignedFileUrl(String flowId) {
        return props.getEsign().getBaseUrl() + "/download/" + flowId;
    }
}
