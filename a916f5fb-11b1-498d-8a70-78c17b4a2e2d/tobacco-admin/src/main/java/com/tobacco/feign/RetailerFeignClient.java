package com.tobacco.feign;

import com.tobacco.common.result.Result;
import com.tobacco.entity.Retailer;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "tobacco-admin", path = "/retailer")
public interface RetailerFeignClient {

    @GetMapping("/{id}")
    Result<Retailer> getRetailerById(@PathVariable("id") Long id);

    @GetMapping("/code/{retailerCode}")
    Result<Retailer> getRetailerByCode(@PathVariable("retailerCode") String retailerCode);

    @PostMapping("/list/ids")
    Result<java.util.List<Retailer>> getRetailersByIds(@RequestBody java.util.List<Long> ids);
}
