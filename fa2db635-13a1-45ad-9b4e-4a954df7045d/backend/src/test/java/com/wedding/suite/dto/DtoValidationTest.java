package com.wedding.suite.dto;

import com.wedding.suite.dto.request.ContractClauseRequest;
import com.wedding.suite.dto.request.ContractDraftRequest;
import com.wedding.suite.dto.request.ContractSignRequest;
import com.wedding.suite.dto.request.ContractUpdateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("DTO JSR-303 校验注解覆盖测试")
class DtoValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private <T> Set<String> fieldsInViolation(T dto) {
        return validator.validate(dto).stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }

    @Test
    @DisplayName("ContractSignRequest: 缺少必填字段触发校验")
    void contractSignRequest_missingRequired_violations() {
        ContractSignRequest req = new ContractSignRequest();
        req.setSignerPhone("13800138000");

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("signer"), "signer 必填校验未生效");
    }

    @Test
    @DisplayName("ContractSignRequest: 手机号格式不正确触发校验")
    void contractSignRequest_invalidPhone_violation() {
        ContractSignRequest req = new ContractSignRequest();
        req.setSigner("张三");
        req.setSignerPhone("123456");

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("signerPhone"), "手机号格式校验未生效");
    }

    @Test
    @DisplayName("ContractSignRequest: 正确格式数据无校验错误")
    void contractSignRequest_valid_noViolations() {
        ContractSignRequest req = new ContractSignRequest();
        req.setSigner("张三");
        req.setSignerPhone("13812345678");

        Set<ConstraintViolation<ContractSignRequest>> vs = validator.validate(req);
        assertTrue(vs.isEmpty(), "合法数据不应有校验错误: " + vs);
    }

    @Test
    @DisplayName("ContractSignRequest: 姓名超过 64 字符触发校验")
    void contractSignRequest_longSigner_violation() {
        ContractSignRequest req = new ContractSignRequest();
        req.setSigner("张".repeat(65));
        req.setSignerPhone("13800138000");

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("signer"), "姓名长度校验未生效");
    }

    @Test
    @DisplayName("ContractDraftRequest: 缺少 weddingId/packageId 触发校验")
    void contractDraftRequest_missingIds_violations() {
        ContractDraftRequest req = new ContractDraftRequest();
        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("weddingId"), "weddingId 必填校验未生效");
        assertTrue(fields.contains("packageId"), "packageId 必填校验未生效");
    }

    @Test
    @DisplayName("ContractDraftRequest: weddingId 为负数触发校验")
    void contractDraftRequest_negativeWeddingId_violation() {
        ContractDraftRequest req = new ContractDraftRequest();
        req.setWeddingId(-1L);
        req.setPackageId(1L);

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("weddingId"), "weddingId 正数校验未生效");
    }

    @Test
    @DisplayName("ContractUpdateRequest: 空条款列表触发校验")
    void contractUpdateRequest_emptyClauses_violation() {
        ContractUpdateRequest req = new ContractUpdateRequest();
        req.setClauses(List.of());

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("clauses"), "clauses 非空校验未生效");
    }

    @Test
    @DisplayName("ContractUpdateRequest: 金额为负触发校验")
    void contractUpdateRequest_negativeAmount_violation() {
        ContractUpdateRequest req = new ContractUpdateRequest();
        ContractClauseRequest cl = new ContractClauseRequest();
        cl.setTitle("t");
        cl.setBody("b");
        req.setClauses(List.of(cl));
        req.setAmount(new BigDecimal("-1"));

        Set<String> fields = fieldsInViolation(req);
        assertTrue(fields.contains("amount"), "金额非负校验未生效");
    }

    @Test
    @DisplayName("ContractClauseRequest: 缺少 title/body 触发嵌套校验")
    void contractClauseRequest_missingTitleBody_violations() {
        ContractUpdateRequest req = new ContractUpdateRequest();
        ContractClauseRequest cl = new ContractClauseRequest();
        req.setClauses(List.of(cl));

        Set<ConstraintViolation<ContractUpdateRequest>> vs = validator.validate(req);
        Set<String> fields = vs.stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(Collectors.toSet());
        assertTrue(fields.stream().anyMatch(f -> f.contains("title")), "条款 title 校验未生效: " + fields);
        assertTrue(fields.stream().anyMatch(f -> f.contains("body")), "条款 body 校验未生效: " + fields);
    }
}
