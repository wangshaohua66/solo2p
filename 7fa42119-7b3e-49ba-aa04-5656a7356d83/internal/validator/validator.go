package validator

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"

	"secfg/internal/errors"
)

const (
	FormatYAML       = "yaml"
	FormatJSON       = "json"
	FormatProperties = "properties"
	FormatUnknown    = "unknown"
)

var ValidEnvironments = map[string]bool{
	"dev":     true,
	"test":    true,
	"staging": true,
	"prod":    true,
}

var SensitiveFieldPatterns = []string{
	"password",
	"secret",
	"token",
	"key",
	"passphrase",
	"private_key",
	"api_key",
	"apikey",
	"access_key",
	"secret_key",
	"db_pass",
	"db_password",
	"redis_pass",
	"mq_password",
}

func ValidateConfigPath(path string) *errors.SecfgError {
	if path == "" {
		return errors.NewWithMessage(errors.E008, "配置路径不能为空", nil, false)
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.NewWithMessage(errors.E001, fmt.Sprintf("配置文件不存在: %s", path), err, false)
		}
		return errors.NewWithMessage(errors.E014, fmt.Sprintf("无法访问配置文件: %s", path), err, false)
	}

	if info.IsDir() {
		return errors.NewWithMessage(errors.E008, fmt.Sprintf("路径是目录而非文件: %s", path), nil, false)
	}

	file, err := os.Open(path)
	if err != nil {
		return errors.NewWithMessage(errors.E002, fmt.Sprintf("配置文件不可读: %s", path), err, false)
	}
	defer file.Close()

	if info.Size() > 10*1024*1024 {
		return errors.NewWithMessage(errors.E008, fmt.Sprintf("配置文件超过10MB限制: %s", path), nil, false)
	}

	return nil
}

func ValidateDirectoryPath(path string) *errors.SecfgError {
	if path == "" {
		return errors.NewWithMessage(errors.E008, "目录路径不能为空", nil, false)
	}

	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.NewWithMessage(errors.E001, fmt.Sprintf("目录不存在: %s", path), err, false)
		}
		return errors.NewWithMessage(errors.E014, fmt.Sprintf("无法访问目录: %s", path), err, false)
	}

	if !info.IsDir() {
		return errors.NewWithMessage(errors.E008, fmt.Sprintf("路径不是目录: %s", path), nil, false)
	}

	return nil
}

func ValidateEnvironment(env string) *errors.SecfgError {
	if !ValidEnvironments[env] {
		return errors.NewWithMessage(errors.E006, fmt.Sprintf("无效的环境名称: %s", env), nil, false)
	}
	return nil
}

func ValidateKeyStrength(key []byte) *errors.SecfgError {
	if len(key) < 32 {
		return errors.NewWithMessage(errors.E005,
			fmt.Sprintf("密钥长度不足: 当前%d字节，需要至少32字节", len(key)), nil, false)
	}

	entropy := calculateEntropy(key)
	if entropy < 3.0 {
		return errors.NewWithMessage(errors.E005,
			fmt.Sprintf("密钥随机性不足: 熵值%.2f，需要至少3.0", entropy), nil, false)
	}

	return nil
}

func calculateEntropy(data []byte) float64 {
	if len(data) == 0 {
		return 0
	}

	freq := make(map[byte]int)
	for _, b := range data {
		freq[b]++
	}

	var entropy float64
	for _, count := range freq {
		p := float64(count) / float64(len(data))
		entropy -= p * log2(p)
	}

	return entropy
}

func log2(x float64) float64 {
	n := 0
	for x >= 2 {
		x /= 2
		n++
	}
	return float64(n)
}

func ValidateKeyFilePermissions(path string) *errors.SecfgError {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return errors.NewWithMessage(errors.E001, fmt.Sprintf("密钥文件不存在: %s", path), err, false)
		}
		return errors.NewWithMessage(errors.E014, fmt.Sprintf("无法访问密钥文件: %s", path), err, false)
	}

	mode := info.Mode().Perm()
	if mode != 0600 {
		return errors.NewWithMessage(errors.E002,
			fmt.Sprintf("密钥文件权限不安全: %04o，需要0600", mode), nil, false)
	}

	return nil
}

func DetectFileFormat(path string) string {
	ext := strings.ToLower(filepath.Ext(path))

	switch ext {
	case ".yaml", ".yml":
		return FormatYAML
	case ".json":
		return FormatJSON
	case ".properties", ".props", ".prop":
		return FormatProperties
	default:
		return detectFormatByContent(path)
	}
}

func detectFormatByContent(path string) string {
	content, err := os.ReadFile(path)
	if err != nil {
		return FormatUnknown
	}

	sample := string(content)
	if len(sample) > 1024 {
		sample = sample[:1024]
	}

	sample = strings.TrimSpace(sample)

	if strings.HasPrefix(sample, "{") || strings.HasPrefix(sample, "[") {
		return FormatJSON
	}

	if strings.Contains(sample, ": ") && (strings.Contains(sample, "\n-") || strings.HasPrefix(sample, "---")) {
		return FormatYAML
	}

	if strings.Contains(sample, "=") && !strings.Contains(sample, ": ") {
		lines := strings.Split(sample, "\n")
		propCount := 0
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "!") {
				continue
			}
			if strings.Contains(line, "=") || strings.Contains(line, ":") {
				propCount++
			}
		}
		if propCount > 0 {
			return FormatProperties
		}
	}

	return FormatUnknown
}

func ValidateFormat(format string) *errors.SecfgError {
	switch format {
	case FormatYAML, FormatJSON, FormatProperties:
		return nil
	default:
		return errors.NewWithMessage(errors.E007, fmt.Sprintf("不支持的文件格式: %s", format), nil, false)
	}
}

func IsSensitiveField(fieldName string) bool {
	lower := strings.ToLower(fieldName)
	for _, pattern := range SensitiveFieldPatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

func GenerateStrongKey(length int) ([]byte, *errors.SecfgError) {
	if length < 32 {
		length = 32
	}

	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?"
	key := make([]byte, length)

	for i := range key {
		num, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return nil, errors.New(errors.E005, err, false)
		}
		key[i] = charset[num.Int64()]
	}

	return key, nil
}

func MaskSensitive(value string) string {
	if len(value) == 0 {
		return ""
	}
	if len(value) <= 4 {
		return strings.Repeat("*", len(value))
	}
	visible := 2
	if len(value) > 10 {
		visible = 4
	}
	return value[:visible] + strings.Repeat("*", len(value)-2*visible) + value[len(value)-visible:]
}
