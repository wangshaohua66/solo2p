package main

import (
	"clear-system/internal/api"

	"github.com/spf13/cobra"
)

var (
	servePort int
	serveHost string
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动HTTP API服务器 (端口8080)",
	Long: `启动HTTP REST API服务器，提供清算任务提交、状态查询、模板管理、机构配置、
流水查询等标准化接口。基于Echo v4高性能Web框架构建。`,
	Example: `  # 默认端口8080
  clear serve

  # 自定义端口
  clear serve --port 9000 --host 127.0.0.1`,
	RunE: func(cmd *cobra.Command, args []string) error {
		server := api.NewAPIServer(appConfig, database)
		addr := ":8080"
		if serveHost != "" && serveHost != "0.0.0.0" {
			addr = serveHost + addr
		}
		if servePort != 0 {
			addr = serveHost + ":" + itoa(servePort)
		}
		writeAuditSafe("serve", bizDate, "", "启动HTTP服务于"+addr, "success")
		return server.Start(addr)
	},
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte(n%10 + '0')
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func init() {
	serveCmd.Flags().IntVar(&servePort, "port", 8080, "监听端口号")
	serveCmd.Flags().StringVar(&serveHost, "host", "0.0.0.0", "绑定地址")
	rootCmd.AddCommand(serveCmd)
}
