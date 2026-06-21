package com.court.execution.service;

import com.court.execution.entity.*;
import com.court.execution.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class CoordinationService {

    private static final Logger logger = LoggerFactory.getLogger(CoordinationService.class);

    private final CoordinationLetterRepository letterRepository;
    private final CoordinationUnitRepository unitRepository;
    private final ExecutionCaseRepository caseRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    private int letterSequence = 1;

    public CoordinationService(CoordinationLetterRepository letterRepository,
                               CoordinationUnitRepository unitRepository,
                               ExecutionCaseRepository caseRepository,
                               PropertyRepository propertyRepository,
                               UserRepository userRepository,
                               NotificationService notificationService) {
        this.letterRepository = letterRepository;
        this.unitRepository = unitRepository;
        this.caseRepository = caseRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    private String generateLetterNumber() {
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String seq = String.format("%04d", letterSequence++);
        return "XZ-" + dateStr + "-" + seq;
    }

    private String generateLetterContent(ExecutionCase caseObj, Property property,
                                          CoordinationUnit unit, String letterType) {
        if (property == null) {
            return generateGeneralLetter(caseObj, unit, letterType);
        }

        return switch (property.getPropertyType()) {
            case BANK_DEPOSIT -> generateBankDepositLetter(caseObj, property, unit, letterType);
            case REAL_ESTATE -> generateRealEstateLetter(caseObj, property, unit, letterType);
            case VEHICLE -> generateVehicleLetter(caseObj, property, unit, letterType);
            case EQUITY -> generateEquityLetter(caseObj, property, unit, letterType);
            case CREDITOR_RIGHTS -> generateCreditorRightsLetter(caseObj, property, unit, letterType);
        };
    }

    private String generateGeneralLetter(ExecutionCase caseObj, CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助执行通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("我院作出的执行裁定书已发生法律效力。\n\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n");
        sb.append("被执行人：").append(caseObj.getDebtorName()).append("\n");
        if (caseObj.getDebtorIdCard() != null) {
            sb.append("身份证号：").append(caseObj.getDebtorIdCard()).append("\n");
        }
        sb.append("\n请协助").append(letterType).append("被执行人相关财产。\n\n");
        sb.append("附：执行裁定书一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());
        return sb.toString();
    }

    private String generateBankDepositLetter(ExecutionCase caseObj, Property property,
                                              CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助查询/冻结存款通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("因执行工作需要，请协助").append(letterType).append("被执行人下列银行账户存款：\n\n");
        sb.append("【案件信息】\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n");
        sb.append("申请执行人：").append(caseObj.getCreditorName() != null ? caseObj.getCreditorName() : "申请人").append("\n\n");
        sb.append("【被执行人信息】\n");
        sb.append("姓名：").append(caseObj.getDebtorName()).append("\n");
        sb.append("身份证号：").append(caseObj.getDebtorIdCard() != null ? caseObj.getDebtorIdCard() : "详见案卷").append("\n\n");
        sb.append("【财产信息】\n");
        sb.append("账户名称：").append(property.getPropertyName()).append("\n");
        sb.append("开户行：").append(unit.getUnitName()).append("\n");
        if (property.getCertificateNumber() != null) {
            sb.append("账号：").append(property.getCertificateNumber()).append("\n");
        }
        if (property.getEstimatedValue() != null) {
            sb.append("申请").append(letterType).append("金额：人民币").append(property.getEstimatedValue()).append("元\n");
        }
        sb.append("\n请贵行予以协助办理，将查询结果或冻结回执函复我院。\n\n");
        sb.append("附：执行裁定书、协助执行通知书各一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());
        return sb.toString();
    }

    private String generateRealEstateLetter(ExecutionCase caseObj, Property property,
                                             CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助查询/查封不动产通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("因执行工作需要，请协助").append(letterType).append("被执行人下列不动产：\n\n");
        sb.append("【案件信息】\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n\n");
        sb.append("【被执行人信息】\n");
        sb.append("权利人（被执行人）：").append(caseObj.getDebtorName()).append("\n");
        sb.append("身份证号：").append(caseObj.getDebtorIdCard() != null ? caseObj.getDebtorIdCard() : "详见案卷").append("\n\n");
        sb.append("【不动产信息】\n");
        sb.append("不动产坐落：").append(property.getPropertyLocation() != null ? property.getPropertyLocation() : property.getPropertyName()).append("\n");
        sb.append("不动产名称：").append(property.getPropertyName()).append("\n");
        if (property.getCertificateNumber() != null) {
            sb.append("不动产权证书号：").append(property.getCertificateNumber()).append("\n");
        }
        sb.append("不动产描述：").append(property.getPropertyDescription() != null ? property.getPropertyDescription() : "详见产权登记").append("\n");
        if (property.getEstimatedValue() != null) {
            sb.append("预估价值：人民币").append(property.getEstimatedValue()).append("元\n");
        }
        sb.append("\n请贵中心协助办理").append(letterType).append("登记手续，并将结果函复我院。\n\n");
        sb.append("附：执行裁定书、协助执行通知书各一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());
        return sb.toString();
    }

    private String generateVehicleLetter(ExecutionCase caseObj, Property property,
                                          CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助查询/查封车辆通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("因执行工作需要，请协助").append(letterType).append("被执行人下列机动车辆：\n\n");
        sb.append("【案件信息】\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n\n");
        sb.append("【被执行人信息】\n");
        sb.append("所有人（被执行人）：").append(caseObj.getDebtorName()).append("\n");
        sb.append("身份证号：").append(caseObj.getDebtorIdCard() != null ? caseObj.getDebtorIdCard() : "详见案卷").append("\n\n");
        sb.append("【车辆信息】\n");
        sb.append("车辆名称：").append(property.getPropertyName()).append("\n");
        if (property.getCertificateNumber() != null) {
            sb.append("车牌号：").append(property.getCertificateNumber()).append("\n");
        }
        if (property.getPropertyLocation() != null) {
            sb.append("车辆登记地：").append(property.getPropertyLocation()).append("\n");
        }
        if (property.getEstimatedValue() != null) {
            sb.append("预估价值：人民币").append(property.getEstimatedValue()).append("元\n");
        }
        sb.append("\n请贵所协助办理车辆登记查询及").append(letterType).append("手续，").append(letterType).append("期间禁止办理过户、抵押等登记。\n\n");
        sb.append("附：执行裁定书、协助执行通知书各一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());
        return sb.toString();
    }

    private String generateEquityLetter(ExecutionCase caseObj, Property property,
                                         CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助查询/冻结股权通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("因执行工作需要，请协助").append(letterType).append("被执行人持有的下列股权/证券：\n\n");
        sb.append("【案件信息】\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n\n");
        sb.append("【被执行人信息】\n");
        sb.append("持有人（被执行人）：").append(caseObj.getDebtorName()).append("\n");
        sb.append("身份证号：").append(caseObj.getDebtorIdCard() != null ? caseObj.getDebtorIdCard() : "详见案卷").append("\n\n");
        sb.append("【股权/证券信息】\n");
        sb.append("标的名称：").append(property.getPropertyName()).append("\n");
        if (property.getCertificateNumber() != null) {
            sb.append("证券代码/股东账号：").append(property.getCertificateNumber()).append("\n");
        }
        if (property.getPropertyDescription() != null) {
            sb.append("持股数量/比例：").append(property.getPropertyDescription()).append("\n");
        }
        if (property.getEstimatedValue() != null) {
            sb.append("预估市值：人民币").append(property.getEstimatedValue()).append("元\n");
        }
        sb.append("\n请贵单位协助办理查询、").append(letterType).append("登记手续，").append(letterType).append("期间不得办理转让、质押等手续。\n\n");
        sb.append("附：执行裁定书、协助执行通知书各一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
        sb.append(LocalDateTime.now().toLocalDate().toString());
        return sb.toString();
    }

    private String generateCreditorRightsLetter(ExecutionCase caseObj, Property property,
                                                 CoordinationUnit unit, String letterType) {
        StringBuilder sb = new StringBuilder();
        sb.append("协助执行通知书\n\n");
        sb.append("致：").append(unit.getUnitName()).append("\n\n");
        sb.append("关于").append(caseObj.getCaseName()).append("一案，\n");
        sb.append("因执行工作需要，请协助").append(letterType).append("被执行人享有的下列债权：\n\n");
        sb.append("【案件信息】\n");
        sb.append("案号：").append(caseObj.getCaseNumber()).append("\n\n");
        sb.append("【被执行人信息】\n");
        sb.append("债权人（被执行人）：").append(caseObj.getDebtorName()).append("\n");
        sb.append("身份证号：").append(caseObj.getDebtorIdCard() != null ? caseObj.getDebtorIdCard() : "详见案卷").append("\n\n");
        sb.append("【债权信息】\n");
        sb.append("债权名称：").append(property.getPropertyName()).append("\n");
        if (property.getPropertyDescription() != null) {
            sb.append("债权描述：").append(property.getPropertyDescription()).append("\n");
        }
        if (property.getEstimatedValue() != null) {
            sb.append("债权金额：人民币").append(property.getEstimatedValue()).append("元\n");
        }
        if (property.getCertificateNumber() != null) {
            sb.append("相关凭证号：").append(property.getCertificateNumber()).append("\n");
        }
        sb.append("\n请贵单位协助办理债权").append(letterType).append("手续，").append(letterType).append("期间不得向被执行人清偿。\n\n");
        sb.append("附：执行裁定书、协助执行通知书各一份\n\n");
        sb.append("联系人：执行局\n");
        sb.append("联系电话：010-12368\n\n");
        sb.append("人民法院执行局（公章）\n");
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
    public int triggerTimeoutReminders(int timeoutHours) {
        LocalDateTime timeoutDate = LocalDateTime.now().minusHours(timeoutHours);
        List<CoordinationLetter> timeoutLetters = letterRepository.findLettersNeedingReminder(timeoutDate);

        logger.info("筛选出超时未反馈的协执函共{}份", timeoutLetters.size());

        int triggeredCount = 0;
        for (CoordinationLetter letter : timeoutLetters) {
            if (Boolean.TRUE.equals(letter.getReminderSent())) {
                continue;
            }

            User judge = letter.getExecutionCase().getJudge();
            if (judge != null) {
                notificationService.sendCoordinationReminder(
                        judge,
                        letter.getId(),
                        letter.getLetterNumber(),
                        letter.getCoordinationUnit().getUnitName(),
                        letter.getSendTime()
                );
            }

            letter.setReminderSent(true);
            letter.setReminderTime(LocalDateTime.now());
            letterRepository.save(letter);
            triggeredCount++;

            logger.info("协执函催办通知已发送：函号={}, 协执单位={}, 接收法官={}",
                    letter.getLetterNumber(),
                    letter.getCoordinationUnit().getUnitName(),
                    judge != null ? judge.getRealName() : "无");
        }

        return triggeredCount;
    }

    @Transactional
    public int sendReminders(int timeoutHours) {
        return triggerTimeoutReminders(timeoutHours);
    }
}
