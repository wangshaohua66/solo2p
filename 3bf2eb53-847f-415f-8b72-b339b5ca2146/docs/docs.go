package docs

import "offshore-wind-ops/internal/model"

// @title Offshore Wind Farm Operations API
// @version 1.0.0
// @description 海上风电运营管理平台后端API服务
// @description 提供风机健康评估、航次调度、人员管理、备件库存、预警通知等核心功能
// @contact.name API Support
// @contact.email support@offshore-wind-ops.com
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

// API整体架构说明：
// - 认证：JWT Bearer Token，访问令牌2小时有效期，刷新令牌7天有效期
// - 限流：每分钟600请求，支持突发100请求
// - 数据存储：MongoDB，时序数据存储在scada_data集合
// - 用户角色：admin/ops_manager/engineer/ship_dispatcher/safety_officer

var _ = model.User{}
