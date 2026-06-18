package com.carbon.common.security;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/test-auth")
public class PreAuthorizeTestController {

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
