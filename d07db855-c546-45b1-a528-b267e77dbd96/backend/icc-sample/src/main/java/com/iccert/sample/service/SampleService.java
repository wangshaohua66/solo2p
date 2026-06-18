package com.iccert.sample.service;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.read.listener.ReadListener;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.iccert.common.exception.BusinessException;
import com.iccert.common.page.PageQuery;
import com.iccert.common.page.PageResult;
import com.iccert.common.result.ResultCode;
import com.iccert.common.utils.CodeGenerator;
import com.iccert.sample.entity.SampleFlowLog;
import com.iccert.sample.entity.SampleInfo;
import com.iccert.sample.excel.SampleImportExcelVO;
import com.iccert.sample.mapper.SampleFlowLogMapper;
import com.iccert.sample.mapper.SampleInfoMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SampleService {

    private final SampleInfoMapper sampleInfoMapper;
    private final SampleFlowLogMapper sampleFlowLogMapper;

    @Value("${sample.retention.default-days:180}")
    private int defaultRetentionDays;

    public PageResult<SampleInfo> page(PageQuery query, String status) {
        LambdaQueryWrapper<SampleInfo> w = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) w.eq(SampleInfo::getSampleStatus, status);
        if (query.getKeyword() != null && !query.getKeyword().isEmpty()) {
            w.like(SampleInfo::getSampleName, query.getKeyword())
                    .or().like(SampleInfo::getSampleCode, query.getKeyword());
        }
        w.orderByDesc(SampleInfo::getReceiveTime);
        Page<SampleInfo> page = sampleInfoMapper.selectPage(
                new Page<>(query.getCurrentSafe(), query.getSizeSafe()), w);
        return PageResult.of(page);
    }

    public SampleInfo getById(Long id) {
        SampleInfo s = sampleInfoMapper.selectById(id);
        if (s == null) throw new BusinessException(ResultCode.SAMPLE_NOT_FOUND);
        return s;
    }

    @Transactional
    public SampleInfo create(SampleInfo sample) {
        sample.setSampleCode(CodeGenerator.genSampleCode());
        sample.setSampleStatus("RECEIVED");
        sample.setReceiveTime(LocalDateTime.now());
        sample.setRetentionExpireDate(CodeGenerator.calcRetentionExpireDate(defaultRetentionDays));
        sampleInfoMapper.insert(sample);
        addFlowLog(sample.getId(), sample.getSampleCode(), "RECEIVED", "样品已接收登记",
                sample.getReceiverId(), sample.getReceiverName(), "系统自动登记");
        return sample;
    }

    @Transactional
    public Map<String, Object> batchImportExcel(MultipartFile file, Long operatorId, String operatorName) {
        List<SampleInfo> successList = new ArrayList<>();
        List<String> errorList = new ArrayList<>();
        int[] row = {0};
        try (InputStream is = file.getInputStream()) {
            EasyExcel.read(is, SampleImportExcelVO.class, new ReadListener<SampleImportExcelVO>() {
                @Override
                public void invoke(SampleImportExcelVO vo, AnalysisContext context) {
                    row[0]++;
                    try {
                        if (vo.getSampleName() == null || vo.getSampleName().isEmpty()) {
                            errorList.add("第" + (row[0] + 1) + "行: 样品名称为空");
                            return;
                        }
                        SampleInfo s = new SampleInfo();
                        s.setSampleName(vo.getSampleName());
                        s.setSampleModel(vo.getSampleModel());
                        s.setSampleCodeInternal(vo.getSampleCodeInternal());
                        s.setCompanyName(vo.getCompanyName() != null ? vo.getCompanyName() : "未知企业");
                        s.setProductCategoryName(vo.getProductCategoryName() != null ? vo.getProductCategoryName() : "未分类");
                        s.setCertTypeCode(vo.getCertTypeCode() != null ? vo.getCertTypeCode() : "CCC");
                        s.setSampleAmount(vo.getSampleAmount() != null ? vo.getSampleAmount() : 1);
                        s.setSampleUnit(vo.getSampleUnit() != null ? vo.getSampleUnit() : "件");
                        s.setPriority(vo.getPriority() != null ? vo.getPriority() : "NORMAL");
                        s.setRemark(vo.getRemark());
                        s.setCreateBy(operatorId);
                        s.setReceiverId(operatorId);
                        s.setReceiverName(operatorName);
                        SampleInfo saved = create(s);
                        successList.add(saved);
                    } catch (Exception e) {
                        errorList.add("第" + (row[0] + 1) + "行: " + e.getMessage());
                    }
                }

                @Override
                public void doAfterAllAnalysed(AnalysisContext context) {
                    log.info("Excel批量导入完成, 成功{}, 失败{}", successList.size(), errorList.size());
                }
            }).sheet().doRead();
        } catch (Exception e) {
            throw new BusinessException("Excel文件解析失败: " + e.getMessage());
        }
        Map<String, Object> result = new HashMap<>();
        result.put("successCount", successList.size());
        result.put("failCount", errorList.size());
        result.put("errors", errorList);
        result.put("successSamples", successList);
        return result;
    }

    @Transactional
    public boolean updateStatus(Long id, String status, Long operatorId, String operatorName, String remark) {
        SampleInfo s = getById(id);
        s.setSampleStatus(status);
        sampleInfoMapper.updateById(s);
        addFlowLog(id, s.getSampleCode(), status, getStatusText(status), operatorId, operatorName, remark);
        return true;
    }

    @Transactional
    public boolean destroySample(Long id, Long operatorId, String operatorName, String destroyRemark) {
        SampleInfo s = getById(id);
        if (!"ARCHIVED".equals(s.getSampleStatus()) && LocalDate.now().isBefore(s.getRetentionExpireDate())) {
            throw new BusinessException(ResultCode.SAMPLE_STATUS_ERROR, "留样期限未到, 不能销毁");
        }
        s.setSampleStatus("DESTROYED");
        s.setDestroyTime(LocalDateTime.now());
        s.setDestroyOperator(operatorName);
        s.setDestroyRemark(destroyRemark);
        sampleInfoMapper.updateById(s);
        addFlowLog(id, s.getSampleCode(), "DESTROYED", "样品已销毁", operatorId, operatorName, destroyRemark);
        return true;
    }

    public List<SampleInfo> getExpiringRetentionSamples() {
        LocalDate today = LocalDate.now();
        return sampleInfoMapper.selectExpiringRetentionSamples(today, today.plusDays(15));
    }

    /**
     * 查询样品流转记录（调用 addFlowLog 持久化的真实记录）。
     */
    public List<SampleFlowLog> listFlowLogs(Long sampleId) {
        return sampleFlowLogMapper.selectList(
                new LambdaQueryWrapper<SampleFlowLog>()
                        .eq(SampleFlowLog::getSampleId, sampleId)
                        .orderByAsc(SampleFlowLog::getOperationTime));
    }

    private String getStatusText(String status) {
        return switch (status) {
            case "RECEIVED" -> "样品已接收";
            case "REGISTERED" -> "样品已登记";
            case "TESTING" -> "检测中";
            case "REPORTED" -> "报告编制中";
            case "CERTIFIED" -> "已发证";
            case "ARCHIVED" -> "已归档";
            case "DESTROYED" -> "已销毁";
            default -> status;
        };
    }

    /**
     * 记录样品流转日志。
     * 通过构造器注入 SampleFlowLogMapper（Spring 容器管理），
     * 替换原先废弃的 ContextLoader.getCurrentWebApplicationContext() 反射获取 Bean 的方式，
     * 确保流转记录能够正确持久化。
     */
    private void addFlowLog(Long sampleId, String sampleCode, String status, String statusText,
                            Long operatorId, String operatorName, String remark) {
        try {
            SampleFlowLog flowLog = new SampleFlowLog();
            flowLog.setSampleId(sampleId);
            flowLog.setSampleCode(sampleCode);
            flowLog.setFlowStatus(status);
            flowLog.setFlowStatusText(statusText);
            flowLog.setOperatorId(operatorId);
            flowLog.setOperatorName(operatorName);
            flowLog.setOperationDesc(remark);
            flowLog.setOperationTime(LocalDateTime.now());
            sampleFlowLogMapper.insert(flowLog);
        } catch (Exception e) {
            log.warn("记录样品流转日志失败", e);
        }
    }
}
