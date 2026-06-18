package errors

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

const (
	E001 = "E001"
	E002 = "E002"
	E003 = "E003"
	E004 = "E004"
	E005 = "E005"
	E006 = "E006"
	E007 = "E007"
	E008 = "E008"
	E009 = "E009"
	E010 = "E010"
	E011 = "E011"
	E012 = "E012"
	E013 = "E013"
	E014 = "E014"
	E015 = "E015"
)

var errorDescriptions = map[string]string{
	E001: "配置文件不存在",
	E002: "密钥权限错误",
	E003: "加密失败",
	E004: "解密失败",
	E005: "密钥强度不足",
	E006: "环境名称无效",
	E007: "文件格式不支持",
	E008: "参数验证失败",
	E009: "备份创建失败",
	E010: "备份恢复失败",
	E011: "审计日志写入失败",
	E012: "配置同步失败",
	E013: "数据库操作失败",
	E014: "文件读取失败",
	E015: "文件写入失败",
}

var errorSuggestions = map[string]string{
	E001: "请检查配置文件路径是否正确，确保文件存在且可读",
	E002: "请检查密钥文件权限，确保为600，且当前用户拥有访问权限",
	E003: "请检查密钥是否正确，数据是否完整",
	E004: "请检查密钥是否正确，加密数据是否被篡改",
	E005: "密钥长度至少需要32字节（256位），请使用生成的强随机密钥",
	E006: "环境名称必须是 dev、test、staging、prod 之一",
	E007: "支持的文件格式为 YAML、JSON、Properties",
	E008: "请检查所有必填参数是否正确提供",
	E009: "请检查磁盘空间是否充足，备份目录是否可写",
	E010: "请检查备份文件是否存在且完整",
	E011: "请检查审计日志目录权限",
	E012: "请检查源环境和目标环境配置是否可访问",
	E013: "请检查数据库文件权限和完整性",
	E014: "请检查文件是否存在，当前用户是否有读取权限",
	E015: "请检查目标路径是否可写，磁盘空间是否充足",
}

type SecfgError struct {
	Code        string
	Description string
	Suggestion  string
	Err         error
	Stack       []string
}

func (e *SecfgError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v\n建议: %s", e.Code, e.Description, e.Err, e.Suggestion)
	}
	return fmt.Sprintf("[%s] %s\n建议: %s", e.Code, e.Description, e.Suggestion)
}

func (e *SecfgError) Unwrap() error {
	return e.Err
}

func New(code string, err error, includeStack bool) *SecfgError {
	desc := errorDescriptions[code]
	if desc == "" {
		desc = "未知错误"
	}
	sug := errorSuggestions[code]
	if sug == "" {
		sug = "请查看日志获取更多信息"
	}

	se := &SecfgError{
		Code:        code,
		Description: desc,
		Suggestion:  sug,
		Err:         err,
	}

	if includeStack {
		se.Stack = captureStack()
	}

	logToFile(se)

	return se
}

func NewWithMessage(code string, message string, err error, includeStack bool) *SecfgError {
	se := New(code, err, includeStack)
	if message != "" {
		se.Description = message
	}
	return se
}

func captureStack() []string {
	var stack []string
	for i := 2; i < 10; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		fn := runtime.FuncForPC(pc)
		funcName := ""
		if fn != nil {
			funcName = fn.Name()
		}
		stack = append(stack, fmt.Sprintf("%s:%d %s", filepath.Base(file), line, funcName))
	}
	return stack
}

func logToFile(e *SecfgError) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}
	logDir := filepath.Join(home, ".secfg")
	if err := os.MkdirAll(logDir, 0700); err != nil {
		return
	}
	logFile := filepath.Join(logDir, "error.log")

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()

	writer := io.Writer(f)
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	fmt.Fprintf(writer, "[%s] [%s] %s", timestamp, e.Code, e.Description)
	if e.Err != nil {
		fmt.Fprintf(writer, ": %v", e.Err)
	}
	fmt.Fprintln(writer)
	if len(e.Stack) > 0 {
		fmt.Fprintln(writer, "堆栈追踪:")
		for _, s := range e.Stack {
			fmt.Fprintf(writer, "  %s\n", s)
		}
	}
}

func Wrap(err error, code string) *SecfgError {
	if se, ok := err.(*SecfgError); ok {
		return se
	}
	return New(code, err, false)
}
