package com.carbon.common.security;

import com.carbon.common.autoconfigure.CarbonCommonAutoConfiguration;
import lombok.RequiredArgsConstructor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PreAuthorizeIntegrationTest.App.class)
@AutoConfigureMockMvc
class PreAuthorizeIntegrationTest {

    @SpringBootApplication
    @Import(CarbonCommonAutoConfiguration.class)
    static class App {
        @Bean
        TestController testController() { return new TestController(); }
    }

    @RestController
    @RequestMapping("/test-auth")
    @RequiredArgsConstructor
    static class TestController {
        @GetMapping("/quota-manage")
        @PreAuthorize("hasAuthority('quota:manage')")
        public String quotaManage() { return "OK"; }

        @GetMapping("/calculation-run")
        @PreAuthorize("hasAuthority('calculation:run')")
        public String calcRun() { return "OK"; }

        @GetMapping("/ccer-manage")
        @PreAuthorize("hasAuthority('ccer:manage')")
        public String ccerManage() { return "OK"; }

        @GetMapping("/public")
        public String openEndpoint() { return "OPEN"; }
    }

    @Autowired
    private WebApplicationContext ctx;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
    }

    @Test
    @DisplayName("缺少身份 header (X-Tenant-Id/X-User-Id) 应返回 401")
    void missingIdentity_shouldReturn401() throws Exception {
        mvc.perform(get("/test-auth/quota-manage"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("有身份但缺少 quota:manage 权限时，访问 /quota-manage 触发 AccessDeniedException (403)")
    void withoutQuotaAuthority_shouldBeDenied() throws Exception {
        mvc.perform(withIdentity(get("/test-auth/quota-manage"), "tenant001", "user001", "some:other"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("有身份且具备 quota:manage 权限时，访问 /quota-manage 返回 200")
    void withQuotaAuthority_shouldBeAllowed() throws Exception {
        mvc.perform(withIdentity(get("/test-auth/quota-manage"), "tenant001", "user001", "quota:manage"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("有身份且具备 calculation:run 权限时，交叉访问 quota-manage 仍返回 403")
    void wrongAuthority_shouldBeDenied() throws Exception {
        mvc.perform(withIdentity(get("/test-auth/quota-manage"), "tenant001", "user001", "calculation:run"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("多权限逗号分隔，具备 ccer:manage 时访问 ccer-manage 返回 200")
    void multipleAuthorities_shouldMatch() throws Exception {
        mvc.perform(withIdentity(get("/test-auth/ccer-manage"), "tenant001", "user001",
                "viewer,ccer:manage,reporter"))
                .andExpect(status().isOk());
    }

    private static MockHttpServletRequestBuilder withIdentity(MockHttpServletRequestBuilder rb,
                                                               String tenantId, String userId,
                                                               String authorities) {
        rb.header("X-Tenant-Id", tenantId);
        rb.header("X-User-Id", userId);
        rb.header("X-Tenant-Name", "AcmeCorp");
        if (authorities != null && !authorities.isEmpty()) {
            rb.header("X-JWT-Authorities", authorities);
        }
        return rb;
    }
}
