package service

import "errors"

var (
	ErrEquipmentUnavailable   = errors.New("设备不可用")
	ErrBookingConflict        = errors.New("预约时间冲突")
	ErrInsufficientBudget     = errors.New("经费余额不足")
	ErrBookingNotFound        = errors.New("预约不存在")
	ErrBookingAlreadyCancelled = errors.New("预约已取消")
	ErrInvalidTimeRange       = errors.New("无效的时间范围")
	ErrBookingNotInRange      = errors.New("预约不在指定时间范围内")
	ErrBillingNotFound        = errors.New("账单不存在")
	ErrEquipmentNotFound      = errors.New("设备不存在")
	ErrUserNotFound           = errors.New("用户不存在")
	ErrInvalidRefund          = errors.New("无效的退费操作")
	ErrAlreadyRefunded        = errors.New("账单已退费")
)
