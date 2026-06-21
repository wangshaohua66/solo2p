package com.gov.specialequipment.controller;

import com.gov.specialequipment.common.PageResult;
import com.gov.specialequipment.common.Result;
import com.gov.specialequipment.dto.DeviceQueryDTO;
import com.gov.specialequipment.dto.DeviceRegisterDTO;
import com.gov.specialequipment.dto.DeviceStatusChangeDTO;
import com.gov.specialequipment.entity.Device;
import com.gov.specialequipment.service.DeviceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "设备管理")
@RestController
@RequestMapping("/devices")
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    @Operation(summary = "设备注册登记")
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'USE_UNIT')")
    public Result<Device> registerDevice(@Valid @RequestBody DeviceRegisterDTO dto) {
        return Result.success("设备注册成功", deviceService.registerDevice(dto));
    }

    @Operation(summary = "查询设备详情")
    @GetMapping("/{id}")
    public Result<Device> getDevice(@PathVariable Long id) {
        return Result.success(deviceService.getDeviceById(id));
    }

    @Operation(summary = "根据设备编码查询")
    @GetMapping("/code/{deviceCode}")
    public Result<Device> getDeviceByCode(@PathVariable String deviceCode) {
        return Result.success(deviceService.getDeviceByCode(deviceCode));
    }

    @Operation(summary = "分页查询设备列表")
    @PostMapping("/page")
    public Result<PageResult<Device>> queryDevices(@RequestBody DeviceQueryDTO dto) {
        return Result.success(deviceService.queryDevices(dto));
    }

    @Operation(summary = "更新设备信息")
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'USE_UNIT')")
    public Result<Device> updateDevice(@PathVariable Long id, @Valid @RequestBody DeviceRegisterDTO dto) {
        return Result.success("设备信息更新成功", deviceService.updateDevice(id, dto));
    }

    @Operation(summary = "设备状态变更（变更、移装、停用、注销）")
    @PostMapping("/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'USE_UNIT')")
    public Result<Void> changeDeviceStatus(@Valid @RequestBody DeviceStatusChangeDTO dto) {
        deviceService.changeDeviceStatus(dto);
        return Result.success("状态变更成功");
    }

    @Operation(summary = "删除设备")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public Result<Void> deleteDevice(@PathVariable Long id) {
        deviceService.deleteDevice(id);
        return Result.success("删除成功");
    }
}
