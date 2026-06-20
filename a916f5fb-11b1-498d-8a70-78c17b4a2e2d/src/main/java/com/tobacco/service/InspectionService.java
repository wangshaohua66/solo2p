package com.tobacco.service;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.tobacco.common.enums.CreditLevel;
import com.tobacco.common.enums.LicenseStatus;
import com.tobacco.common.enums.ViolationType;
import com.tobacco.common.exception.BusinessException;
import com.tobacco.common.result.PageResult;
import com.tobacco.common.result.ResultCode;
import com.tobacco.dto.request.InspectionTaskQuery;
import com.tobacco.dto.request.ViolationRecordQuery;
import com.tobacco.dto.request.ViolationRecordRequest;
import com.tobacco.entity.InspectionTask;
import com.tobacco.entity.License;
import com.tobacco.entity.Retailer;
import com.tobacco.entity.ViolationRecord;
import com.tobacco.mapper.InspectionTaskMapper;
import com.tobacco.mapper.LicenseMapper;
import com.tobacco.mapper.RetailerMapper;
import com.tobacco.mapper.ViolationRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionService {

    private final InspectionTaskMapper inspectionTaskMapper;
    private final ViolationRecordMapper violationRecordMapper;
    private final RetailerMapper retailerMapper;
    private final LicenseMapper licenseMapper;
    @Lazy
    private final CreditService creditService;

    public List<InspectionTask> autoAssignTasks(Long stationId, Long inspectorId, String inspectorName) {
        List<Retailer> retailers = getRetailersForInspection(stationId);
        List<InspectionTask> tasks = new ArrayList<>();

        for (Retailer retailer : retailers) {
            String riskLevel = calculateRiskLevel(retailer);

            InspectionTask task = new InspectionTask();
            task.setTaskNo(generateTaskNo());
            task.setTaskType("ROUTINE");
            task.setRetailerId(retailer.getId());
            task.setRetailerName(retailer.getRetailerName());
            task.setLicenseNo(retailer.getLicenseNo());
            task.setInspectorId(inspectorId);
            task.setInspectorName(inspectorName);
            task.setRiskLevel(riskLevel);
            task.setGridId(retailer.getGridId());
            task.setCountyId(retailer.getCountyId());
            task.setStationId(stationId);
            task.setPlanDate(LocalDateTime.now().plusDays(1));
            task.setStatus(1);
            task.setHasViolation(0);

            inspectionTaskMapper.insert(task);
            tasks.add(task);
        }

        log.info("自动派发稽查任务完成，共派发 {} 条任务", tasks.size());
        return tasks;
    }

    private List<Retailer> getRetailersForInspection(Long stationId) {
        LambdaQueryWrapper<Retailer> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Retailer::getStationId, stationId)
                .eq(Retailer::getStatus, 1)
                .last("LIMIT 20");
        return retailerMapper.selectList(wrapper);
    }

    private String calculateRiskLevel(Retailer retailer) {
        CreditLevel creditLevel = CreditLevel.getByCode(retailer.getCreditLevel());
        if (creditLevel == null) return "medium";

        int rank = creditLevel.getRank();
        if (rank >= 3) return "low";
        if (rank >= 1) return "medium";
        return "high";
    }

    @Transactional(rollbackFor = Exception.class)
    public ViolationRecord recordViolation(ViolationRecordRequest request, Long inspectorId, String inspectorName) {
        InspectionTask task = inspectionTaskMapper.selectById(request.getTaskId());
        if (task == null) {
            throw new BusinessException(ResultCode.INSPECTION_TASK_NOT_FOUND);
        }

        ViolationType violationType = ViolationType.getByCode(request.getViolationType());
        if (violationType == null) {
            throw new BusinessException("违规类型不存在");
        }

        ViolationRecord record = new ViolationRecord();
        record.setRecordNo(generateRecordNo());
        record.setTaskId(task.getId());
        record.setRetailerId(task.getRetailerId());
        record.setRetailerName(task.getRetailerName());
        record.setLicenseNo(task.getLicenseNo());
        record.setViolationType(request.getViolationType());
        record.setViolationTypeName(violationType.getName());
        record.setSeverity(violationType.getSeverity());
        record.setDescription(request.getDescription());
        record.setInspectorId(inspectorId);
        record.setInspectorName(inspectorName);
        record.setCountyId(task.getCountyId());
        record.setStationId(task.getStationId());
        record.setDeductPoints(violationType.getDeductPoints());
        record.setHasTriggeredPenalty(0);
        record.setStatus(0);
        record.setDisposalOpinion(request.getDisposalOpinion());

        violationRecordMapper.insert(record);

        task.setHasViolation(1);
        task.setStatus(3);
        task.setActualDate(LocalDateTime.now());
        inspectionTaskMapper.updateById(task);

        creditService.processViolation(record);

        checkAndTriggerLicensePenalty(task.getRetailerId(), violationType);

        log.info("违规记录已录入，记录号：{}，违规类型：{}", record.getRecordNo(), violationType.getName());
        return record;
    }

    private void checkAndTriggerLicensePenalty(Long retailerId, ViolationType violationType) {
        if ("high".equals(violationType.getSeverity())) {
            License license = licenseMapper.selectLatestByRetailerId(retailerId);
            if (license != null && LicenseStatus.APPROVED.getCode().equals(license.getStatus())) {
                log.info("严重违规触发许可证停业流程，零售户ID：{}", retailerId);
            }
        }
    }

    public InspectionTask getTaskById(Long id) {
        InspectionTask task = inspectionTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException(ResultCode.INSPECTION_TASK_NOT_FOUND);
        }
        return task;
    }

    public PageResult<InspectionTask> getTaskPage(InspectionTaskQuery query) {
        Page<InspectionTask> page = new Page<>(query.getPageNum(), query.getPageSize());
        IPage<InspectionTask> result = inspectionTaskMapper.selectPageByCondition(
                page,
                query.getStatus(),
                query.getInspectorId(),
                query.getCountyId(),
                query.getStationId(),
                query.getRiskLevel(),
                query.getHasViolation()
        );
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    public ViolationRecord getViolationRecordById(Long id) {
        ViolationRecord record = violationRecordMapper.selectById(id);
        if (record == null) {
            throw new BusinessException(ResultCode.INSPECTION_RECORD_NOT_FOUND);
        }
        return record;
    }

    public PageResult<ViolationRecord> getViolationRecordPage(ViolationRecordQuery query) {
        Page<ViolationRecord> page = new Page<>(query.getPageNum(), query.getPageSize());
        IPage<ViolationRecord> result = violationRecordMapper.selectPageByCondition(
                page,
                query.getStatus(),
                query.getViolationType(),
                query.getCountyId(),
                query.getStationId(),
                query.getSeverity(),
                query.getKeyword()
        );
        return PageResult.of(result.getTotal(), result.getPages(), result.getRecords());
    }

    public List<ViolationRecord> getViolationRecordsByRetailer(Long retailerId) {
        return violationRecordMapper.selectByRetailerId(retailerId, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public ViolationRecord disposeViolation(Long recordId, String disposalOpinion, Long operatorId) {
        ViolationRecord record = violationRecordMapper.selectById(recordId);
        if (record == null) {
            throw new BusinessException(ResultCode.INSPECTION_RECORD_NOT_FOUND);
        }

        record.setStatus(1);
        record.setDisposalOpinion(disposalOpinion);
        record.setDisposalTime(LocalDateTime.now());
        violationRecordMapper.updateById(record);

        log.info("违规记录已处理，记录号：{}", record.getRecordNo());
        return record;
    }

    private String generateTaskNo() {
        return "IT" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 8);
    }

    private String generateRecordNo() {
        return "VR" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) +
                IdUtil.getSnowflakeNextIdStr().substring(0, 8);
    }
}
