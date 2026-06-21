package com.court.execution.service;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class CoordinationService {

    private final CoordinationLetterRepository letterRepository;
    private final CoordinationUnitRepository unitRepository;
    private final ExecutionCaseRepository caseRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;

    private int letterSequence = 1;

    public CoordinationService(CoordinationLetterRepository letterRepository,
                               CoordinationUnitRepository unitRepository,
                               ExecutionCaseRepository caseRepository,
                               PropertyRepository propertyRepository,
                               UserRepository userRepository) {
        this.letterRepository = letterRepository;
        this.unitRepository = unitRepository;
        this.caseRepository = caseRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
    }

    private String generateLetterNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%04d", letterSequence++);
        return "XZ-" + dateStr + "-" + seq;
    }

    private String generateLetterContent(ExecutionCase caseObj, Property property,
                                          CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助执行通知书\n\n");
        sb.append("单位：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n");
        sb.append("被执行人：").append(caseObj.getDebtorName()).append("\n\n");

        if (property != null) {
            sb.append("请协助").append(letterType).append("以下财产：\n");
            sb.append("财产类型：").append(property.getPropertyType()).append("\n");
            sb.append("财产名称：").append(property.getPropertyName()).append("\n");
            sb.append("证件号码：").append(property.getCertificateNumber() != null ? property.getCertificateNumber() : "无").append("\n\n");
        }

        sb.append("请予协助办理为盼。\n\n");
        sb.append("人民法院执行局\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());

        return sb.toString();
    }

    @Transactional
    public CoordinationLetter createLetter(Long caseId, Long propertyId, Long unitId,
                                            String letterType, String creatorUsername) {
        ExecutionCase caseObj = caseRepository.findById(caseId)
                .orElseThrow(() -> new RuntimeException("案件不存在"));

        CoordinationUnit unit = unitRepository.findById(unitId)
                .orElseThrow(() -> new RuntimeException("协执单位不存在"));

        User creator = userRepository.findByUsername(creatorUsername)
                .orElseThrow(() -> new RuntimeException("用户不存在"));

        Property property = null;
        PropertyType propertyType = unit.getPropertyType();
        if (propertyId != null) {
            property = propertyRepository.findById(propertyId)
                    .orElseThrow(() -> new RuntimeException("财产不存在"));
            propertyType = property.getPropertyType();
        }

        String letterNumber = generateLetterNumber();
        String content = generateLetterContent(caseObj, property, unit, letterType);

        CoordinationLetter letter = new CoordinationLetter();
        letter.setLetterNumber(letterNumber);
        letter.setExecutionCase(caseObj);
        letter.setProperty(property);
        letter.setCoordinationUnit(unit);
        letter.setPropertyType(propertyType);
        letter.setLetterType(letterType);
        letter.setLetterContent(content);
        letter.setStatus("DRAFT");
        letter.setCreator(creator);

        return letterRepository.save(letter);
    }

    public CoordinationLetter getLetterById(Long id) {
        return letterRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("协执函不存在"));
    }

    public List<CoordinationLetter> getLettersByCaseId(Long caseId) {
        return letterRepository.findByExecutionCaseIdOrderByCreateTimeDesc(caseId);
    }

    public Page<CoordinationLetter> getLettersByStatus(String status, Pageable pageable) {
        return letterRepository.findByStatus(status, pageable);
    }

    @Transactional
    public CoordinationLetter sendLetter(Long letterId) {
        CoordinationLetter letter = getLetterById(letterId);
        letter.setStatus("SENT");
        letter.setSendTime(LocalDateTime.now());
        return letterRepository.save(letter);
    }

    @Transactional
    public List<CoordinationLetter> batchSendLetters(List<Long> letterIds) {
        return letterIds.stream()
                .map(this::sendLetter)
                .toList();
    }

    @Transactional
    public List<CoordinationLetter> batchSendByCaseAndType(Long caseId, PropertyType propertyType,
                                                           String letterType, String creatorUsername) {
        List<Property> properties = propertyRepository.findByExecutionCaseId(caseId).stream()
                .filter(p -> p.getPropertyType() == propertyType)
                .toList();

        if (properties.isEmpty()) {
            throw new RuntimeException("该案件下没有对应类型的财产");
        }

        List<CoordinationUnit> units = unitRepository.findByPropertyTypeAndEnabledTrue(propertyType);
        if (units.isEmpty()) {
            throw new RuntimeException("没有对应的协执单位");
        }

        return properties.stream()
                .flatMap(p -> units.stream().map(u -> createLetter(caseId, p.getId(), u.getId(), letterType, creatorUsername)))
                .map(letter -> sendLetter(letter.getId()))
                .toList();
    }

    @Transactional
    public CoordinationLetter submitFeedback(Long letterId, String feedbackContent) {
        CoordinationLetter letter = getLetterById(letterId);
        letter.setFeedbackContent(feedbackContent);
        letter.setFeedbackTime(LocalDateTime.now());
        letter.setStatus("FEEDBACK");
        return letterRepository.save(letter);
    }

    public List<CoordinationUnit> getAllUnits() {
        return unitRepository.findByEnabledTrue();
    }

    public List<CoordinationUnit> getUnitsByPropertyType(PropertyType propertyType) {
        return unitRepository.findByPropertyTypeAndEnabledTrue(propertyType);
    }

    @Transactional
    public CoordinationUnit createUnit(CoordinationUnit unit) {
        if (unitRepository.existsByUnitName(unit.getUnitName())) {
            throw new RuntimeException("协执单位已存在");
        }
        unit.setEnabled(true);
        return unitRepository.save(unit);
    }

    @Transactional
    public CoordinationUnit updateUnit(Long id, CoordinationUnit unit) {
        CoordinationUnit existing = unitRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("协执单位不存在"));
        existing.setUnitName(unit.getUnitName());
        existing.setPropertyType(unit.getPropertyType());
        existing.setAddress(unit.getAddress());
        existing.setContactPerson(unit.getContactPerson());
        existing.setContactPhone(unit.getContactPhone());
        existing.setEmail(unit.getEmail());
        existing.setRemark(unit.getRemark());
        return unitRepository.save(existing);
    }

    @Transactional
    public void deleteUnit(Long id) {
        CoordinationUnit unit = unitRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("协执单位不存在"));
        unit.setEnabled(false);
        unitRepository.save(unit);
    }

    public List<CoordinationLetter> getLettersNeedingReminder(int timeoutHours) {
        LocalDateTime timeoutDate = LocalDateTime.now().minusHours(timeoutHours);
        return letterRepository.findLettersNeedingReminder(timeoutDate);
    }

    @Transactional
    public int sendReminders(int timeoutHours) {
        List<CoordinationLetter> letters = getLettersNeedingReminder(timeoutHours);
        for (CoordinationLetter letter : letters) {
            letter.setReminderSent(true);
            letter.setReminderTime(LocalDateTime.now());
            letterRepository.save(letter);
        }
        return letters.size();
    }
}
