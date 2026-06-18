package com.wedding.suite.service;

import com.wedding.suite.dto.response.SignResultVO;

public interface SignService {
    SignResultVO createSignFlow(Long contractId, String signerName, String signerPhone);

    SignResultVO queryStatus(String flowId);

    String downloadSignedFileUrl(String flowId);

    boolean isEnabled();
}
