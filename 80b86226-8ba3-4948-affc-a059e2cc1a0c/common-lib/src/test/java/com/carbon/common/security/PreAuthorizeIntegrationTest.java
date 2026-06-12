package com.carbon.common.security;

import com.carbon.common.autoconfigure.CarbonCommonAutoConfiguration;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = PreAuthorizeIntegrationTest.App.class)
@AutoConfigureMockMvc
class PreAuthorizeIntegrationTest {

    @SpringBootApplication
    @Import({CarbonCommonAutoConfiguration.class, PreAuthorizeTestController.class})
    @EnableMethodSecurity
    static class App {
        @Bean
        MongoClient mongoClient() {
            MongoClient client = mock(MongoClient.class);
            MongoDatabase db = mock(MongoDatabase.class);
            when(client.getDatabase(anyString())).thenReturn(db);
            return client;
        }
    }

    @Autowired
    private MockMvc mvc;

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
