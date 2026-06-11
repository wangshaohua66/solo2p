package com.scriptkill.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scriptkill.dto.common.ApiResponse;
import com.scriptkill.dto.session.SessionCreateRequest;
import com.scriptkill.dto.session.SessionResponse;
import com.scriptkill.entity.enums.Role;
import com.scriptkill.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {
        AuthController.class, SessionController.class, BookingController.class,
        ClueController.class, PlayerController.class, ScriptController.class,
        ReviewController.class, DMScheduleController.class, PurchaseController.class
}, excludeAutoConfiguration = {
        SecurityAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class
}, excludeFilters = {
        @ComponentScan.Filter(type = FilterType.REGEX, pattern = "com\\.scriptkill\\.security\\..*"),
        @ComponentScan.Filter(type = FilterType.REGEX, pattern = "com\\.scriptkill\\.config\\.SecurityConfig.*")
})
class SessionAndBookingWebMvcTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;
    @MockBean
    private SessionService sessionService;
    @MockBean
    private MatchingService matchingService;
    @MockBean
    private BookingService bookingService;
    @MockBean
    private RiskService riskService;
    @MockBean
    private ClueService clueService;
    @MockBean
    private ClueSseService clueSseService;
    @MockBean
    private PlayerService playerService;
    @MockBean
    private ScriptService scriptService;
    @MockBean
    private ReviewService reviewService;
    @MockBean
    private DMScheduleService dmScheduleService;
    @MockBean
    private PurchaseService purchaseService;

    @BeforeEach
    void setup() {
        var user = new com.scriptkill.entity.User();
        user.setId(3L);
        user.setUsername("dm01");
        user.setRole(Role.DM);
        user.setNickname("DM小A");
        Mockito.when(authService.getCurrentUser()).thenReturn(user);
    }

    @Test
    @DisplayName("功能9：Session路径已改为/api/session - 200")
    void testSessionPathChanged() throws Exception {
        com.scriptkill.dto.common.PageResult<com.scriptkill.dto.session.SessionResponse> resp =
                new com.scriptkill.dto.common.PageResult<>(
                        java.util.List.of(), 0, 10, 0L, 0, false);
        Mockito.when(sessionService.listSessions(0, 10, null))
                .thenReturn(resp);
        mvc.perform(get("/api/session"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("功能9：旧路径/api/sessions 不可用 - 404")
    void testOldSessionsPath404() throws Exception {
        mvc.perform(get("/api/sessions"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("功能3：线索时间轴 - 支持startTime/endTime参数 - 200")
    void testClueTimelineWithRange() throws Exception {
        Mockito.when(clueService.getClueTimeline(eq(1L), any(), any()))
                .thenReturn(java.util.List.of());
        mvc.perform(get("/api/clues/session/1/timeline")
                        .param("startTime", "2024-12-01T00:00:00")
                        .param("endTime", "2024-12-31T23:59:59"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("功能3：SSE订阅端点存在 - /api/clues/session/{id}/subscribe - 200")
    void testSseSubscribeEndpoint() throws Exception {
        Mockito.when(clueSseService.subscribe(eq(1L)))
                .thenReturn(new org.springframework.web.servlet.mvc.method.annotation.SseEmitter());
        mvc.perform(get("/api/clues/session/1/subscribe"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("静态资源CSS路径 - Spring MVC静态资源默认处理 - 404（无实际文件）")
    void testStaticResourcePath() throws Exception {
        mvc.perform(get("/swagger-ui.css"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("功能7：Swagger分组name=session - ClueController映射检查")
    void testClueControllerPathWorks() throws Exception {
        Mockito.when(clueService.getAvailableClues(1L))
                .thenReturn(java.util.List.of());
        mvc.perform(get("/api/clues/session/1"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("功能9：创建会话 POST /api/session - 200")
    void testCreateSession() throws Exception {
        SessionCreateRequest req = new SessionCreateRequest();
        req.setScriptId(1L);
        req.setDmId(3L);
        req.setStartTime(java.time.LocalDateTime.now().plusDays(1));
        req.setMaxPlayers(6);
        req.setRoomNumber("A101");
        req.setDepositAmount(50);
        req.setPricePerPerson(128);

        var resp = new SessionResponse();
        resp.setId(10L);
        Mockito.when(sessionService.createSession(any())).thenReturn(resp);

        mvc.perform(post("/api/session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(10));
    }
}
