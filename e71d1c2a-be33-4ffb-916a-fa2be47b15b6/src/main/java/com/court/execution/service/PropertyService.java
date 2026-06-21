package com.court.execution.service;

import com.court.execution.dto.PropertyRegisterRequest;
import com.court.execution.dto.SeizureRequest;
import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final SeizureRecordRepository seizureRepository;
    private final ExecutionCaseRepository caseRepository;
    private final CoordinationUnitRepository unitRepository;
    private final UserRepository userRepository;

    public PropertyService(PropertyRepository propertyRepository,
                           SeizureRecordRepository seizureRepository,
                           ExecutionCaseRepository caseRepository,
                           CoordinationUnitRepository unitRepository,
                           UserRepository userRepository) {
        this.propertyRepository = propertyRepository;
        this.seizureRepository = seizureRepository;
        this.caseRepository = caseRepository;
        this.unitRepository = unitRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Property registerProperty(PropertyRegisterRequest request) {
        ExecutionCase caseObj = caseRepository.findById(request.getCaseId())
                .orElseThrow(() -> new RuntimeException("案件不存在"));

        Property property = new Property();
        property.setExecutionCase(caseObj);
        property.setPropertyType(request.getPropertyType());
        property.setPropertyName(request.getPropertyName());
        property.setPropertyDescription(request.getPropertyDescription());
        property.setEstimatedValue(request.getEstimatedValue());
        property.setPropertyLocation(request.getPropertyLocation());
        property.setCertificateNumber(request.getCertificateNumber());
        property.setRemark(request.getRemark());

        return propertyRepository.save(property);
    }

    public Property getPropertyById(Long id) {
        return propertyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("财产不存在"));
    }

    public List<Property> getPropertiesByCaseId(Long caseId) {
        return propertyRepository.findByExecutionCaseId(caseId);
    }

    public Page<Property> getPropertiesByCaseId(Long caseId, Pageable pageable) {
        return propertyRepository.findByExecutionCaseId(caseId, pageable);
    }

    @Transactional
    public SeizureRecord createSeizure(SeizureRequest request, String operatorUsername) {
        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new RuntimeException("财产不存在"));

        User operator = userRepository.findByUsername(operatorUsername)
                .orElseThrow(() -> new RuntimeException("操作员不存在"));

        SeizureRecord record = new SeizureRecord();
        record.setProperty(property);
        record.setExecutionCase(property.getExecutionCase());
        record.setSeizureType(request.getSeizureType());
        record.setSeizureDocumentNumber(request.getSeizureDocumentNumber());
        record.setStartDate(request.getStartDate());
        record.setEndDate(request.getEndDate());
        record.setOperator(operator);
        record.setApprovalStatus("PENDING");
        record.setRemark(request.getRemark());

        if (request.getCoordinationUnitId() != null) {
            CoordinationUnit unit = unitRepository.findById(request.getCoordinationUnitId())
                    .orElseThrow(() -> new RuntimeException("协执单位不存在"));
            record.setCoordinationUnit(unit);
        }

        SeizureRecord saved = seizureRepository.save(record);

        property.setSeized(true);
        property.setSeizeDate(request.getStartDate());
        property.setSeizeExpireDate(request.getEndDate());
        propertyRepository.save(property);

        return saved;
    }

    public List<SeizureRecord> getSeizureRecordsByPropertyId(Long propertyId) {
        return seizureRepository.findByPropertyIdOrderByCreateTimeDesc(propertyId);
    }

    public List<SeizureRecord> getSeizureRecordsByCaseId(Long caseId) {
        return seizureRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId);
    }

    @Transactional
    public SeizureRecord approveSeizure(Long seizureId, String approverUsername, boolean approved) {
        SeizureRecord record = seizureRepository.findById(seizureId)
                .orElseThrow(() -> new RuntimeException("查封记录不存在"));

        User approver = userRepository.findByUsername(approverUsername)
                .orElseThrow(() -> new RuntimeException("审批人不存在"));

        record.setApprover(approver);
        record.setApprovalStatus(approved ? "APPROVED" : "REJECTED");

        return seizureRepository.save(record);
    }

    @Transactional
    public SeizureRecord extendSeizure(Long seizureId, LocalDateTime newEndDate, String operatorUsername) {
        SeizureRecord record = seizureRepository.findById(seizureId)
                .orElseThrow(() -> new RuntimeException("查封记录不存在"));

        if (record.getExpired()) {
            throw new RuntimeException("查封已过期，不能续封");
        }

        User operator = userRepository.findByUsername(operatorUsername)
                .orElseThrow(() -> new RuntimeException("操作员不存在"));

        SeizureRecord newRecord = new SeizureRecord();
        newRecord.setProperty(record.getProperty());
        newRecord.setExecutionCase(record.getExecutionCase());
        newRecord.setSeizureType(record.getSeizureType());
        newRecord.setSeizureDocumentNumber(record.getSeizureDocumentNumber() + "（续封）");
        newRecord.setCoordinationUnit(record.getCoordinationUnit());
        newRecord.setStartDate(record.getEndDate());
        newRecord.setEndDate(newEndDate);
        newRecord.setOperator(operator);
        newRecord.setApprovalStatus("PENDING");
        newRecord.setRemark("续封");

        SeizureRecord saved = seizureRepository.save(newRecord);

        Property property = record.getProperty();
        property.setSeizeExpireDate(newEndDate);
        propertyRepository.save(property);

        return saved;
    }

    @Transactional
    public SeizureRecord releaseSeizure(Long seizureId, String operatorUsername) {
        SeizureRecord record = seizureRepository.findById(seizureId)
                .orElseThrow(() -> new RuntimeException("查封记录不存在"));

        User operator = userRepository.findByUsername(operatorUsername)
                .orElseThrow(() -> new RuntimeException("操作员不存在"));

        record.setReleaseDate(LocalDateTime.now());
        record.setExpired(true);
        record.setApprovalStatus("RELEASED");

        SeizureRecord saved = seizureRepository.save(record);

        Property property = record.getProperty();
        boolean hasOtherValidSeizures = seizureRepository.findByPropertyIdOrderByCreateTimeDesc(property.getId())
                .stream()
                .anyMatch(s -> !s.getExpired() && s.getId() != seizureId);

        if (!hasOtherValidSeizures) {
            property.setSeized(false);
            property.setSeizeDate(null);
            property.setSeizeExpireDate(null);
            propertyRepository.save(property);
        }

        return saved;
    }

    public List<Property> getExpiringProperties(int days) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime warningDate = now.plusDays(days);
        return propertyRepository.findSeizedPropertiesExpiringBetween(now, warningDate);
    }

    public List<Property> getExpiredProperties() {
        return propertyRepository.findExpiredSeizedProperties(LocalDateTime.now());
    }
}
