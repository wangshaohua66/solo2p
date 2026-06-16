# 物证管理系统 - 数据库迁移说明

## 生成迁移

在项目根目录执行以下命令生成初始迁移：

```bash
dotnet ef migrations add InitialCreate -o Migrations
```

## 应用迁移

```bash
dotnet ef database update
```

或者在程序启动时自动应用（生产环境不推荐）。

## 环境要求

- .NET SDK 8.0+
- PostgreSQL 16+
- EF Core Tools

## 注意事项

1. 首次运行前请确保PostgreSQL数据库已启动
2. 连接字符串在appsettings.json中配置
3. 数据库会自动创建默认用户（密码见DbInitializer）
