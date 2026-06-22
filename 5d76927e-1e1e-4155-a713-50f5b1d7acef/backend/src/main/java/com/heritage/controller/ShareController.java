package com.heritage.controller;

import com.heritage.common.ApiResponse;
import com.heritage.service.ShareService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/share")
@Tag(name = "社交分享", description = "微信、微博等社交平台分享接口（含原生JS-SDK配置）")
public class ShareController {

    @Autowired
    private ShareService shareService;

    @GetMapping("/heritage/{heritageId}")
    @Operation(summary = "获取非遗项目分享信息", description = "获取微信、微博等平台的分享参数，包括标题、描述、链接、图片以及JS-SDK签名配置")
    public ApiResponse<Map<String, Object>> getHeritageShareInfo(@PathVariable String heritageId) {
        try {
            return ApiResponse.success(shareService.getHeritageShareInfo(heritageId));
        } catch (RuntimeException e) {
            return ApiResponse.error(404, e.getMessage());
        }
    }

    @GetMapping("/inheritor/{inheritorId}")
    @Operation(summary = "获取传承人分享信息", description = "获取传承人档案的微信、微博分享参数及JS-SDK签名配置")
    public ApiResponse<Map<String, Object>> getInheritorShareInfo(@PathVariable String inheritorId) {
        try {
            return ApiResponse.success(shareService.getInheritorShareInfo(inheritorId));
        } catch (RuntimeException e) {
            return ApiResponse.error(404, e.getMessage());
        }
    }

    @GetMapping("/wechat/js-config")
    @Operation(summary = "获取微信JSSDK配置", description = "获取wx.config所需的appId、timestamp、nonceStr、signature等签名参数，用于初始化微信JS-SDK")
    public ApiResponse<Map<String, Object>> getWechatJsConfig(
            @RequestParam(required = false, defaultValue = "") String url) {
        String useUrl = url.isEmpty() ? "https://heritage.example.com" : url;
        return ApiResponse.success(shareService.getWechatJsConfig(useUrl));
    }
}
