package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"

	"secfg/internal/crypto"
	"secfg/internal/errors"
	"secfg/internal/validator"
)

type ConfigData struct {
	Data   map[string]interface{}
	Format string
	Path   string
}

type DiffItem struct {
	Path      string
	OldValue  interface{}
	NewValue  interface{}
	Operation string
}

type DiffReport struct {
	SourceEnv      string
	TargetEnv      string
	AddedItems     []DiffItem
	ModifiedItems  []DiffItem
	RemovedItems   []DiffItem
	TotalChanges   int
}

type FieldMapping struct {
	SourcePath string
	TargetPath string
	Transform  string
}

type Manager struct {
	vault *crypto.Vault
}

func NewManager(vault *crypto.Vault) *Manager {
	return &Manager{vault: vault}
}

func (m *Manager) LoadConfig(path, format string) (*ConfigData, *errors.SecfgError) {
	if err := validator.ValidateConfigPath(path); err != nil {
		return nil, err
	}

	if format == "" || format == validator.FormatUnknown {
		format = validator.DetectFileFormat(path)
	}

	if err := validator.ValidateFormat(format); err != nil {
		return nil, err
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return nil, errors.New(errors.E014, err, false)
	}

	data, secErr := m.parseContent(content, format)
	if secErr != nil {
		return nil, secErr
	}

	return &ConfigData{
		Data:   data,
		Format: format,
		Path:   path,
	}, nil
}

func (m *Manager) SaveConfig(cfg *ConfigData, outputPath string) *errors.SecfgError {
	content, secErr := m.serializeContent(cfg.Data, cfg.Format)
	if secErr != nil {
		return secErr
	}

	writePath := outputPath
	if writePath == "" {
		writePath = cfg.Path
	}

	if err := os.WriteFile(writePath, content, 0644); err != nil {
		return errors.New(errors.E015, err, false)
	}

	return nil
}

func (m *Manager) parseContent(content []byte, format string) (map[string]interface{}, *errors.SecfgError) {
	switch format {
	case validator.FormatYAML:
		return m.parseYAML(content)
	case validator.FormatJSON:
		return m.parseJSON(content)
	case validator.FormatProperties:
		return m.parseProperties(content)
	default:
		return nil, errors.NewWithMessage(errors.E007, fmt.Sprintf("不支持的格式: %s", format), nil, false)
	}
}

func (m *Manager) parseYAML(content []byte) (map[string]interface{}, *errors.SecfgError) {
	var data map[string]interface{}
	decoder := yaml.NewDecoder(bytes.NewReader(content))
	if stdErr := decoder.Decode(&data); stdErr != nil && stdErr != io.EOF {
		return nil, errors.New(errors.E014, stdErr, false)
	}
	if data == nil {
		data = make(map[string]interface{})
	}
	return data, nil
}

func (m *Manager) parseJSON(content []byte) (map[string]interface{}, *errors.SecfgError) {
	var data map[string]interface{}
	if err := json.Unmarshal(content, &data); err != nil {
		return nil, errors.New(errors.E014, err, false)
	}
	return data, nil
}

func (m *Manager) parseProperties(content []byte) (map[string]interface{}, *errors.SecfgError) {
	data := make(map[string]interface{})
	lines := strings.Split(string(content), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "!") {
			continue
		}

		sepIndex := strings.IndexAny(line, "=:")
		if sepIndex == -1 {
			data[line] = ""
			continue
		}

		key := strings.TrimSpace(line[:sepIndex])
		value := strings.TrimSpace(line[sepIndex+1:])
		data[key] = value
	}

	return data, nil
}

func (m *Manager) serializeContent(data map[string]interface{}, format string) ([]byte, *errors.SecfgError) {
	switch format {
	case validator.FormatYAML:
		return m.serializeYAML(data)
	case validator.FormatJSON:
		return m.serializeJSON(data)
	case validator.FormatProperties:
		return m.serializeProperties(data)
	default:
		return nil, errors.NewWithMessage(errors.E007, fmt.Sprintf("不支持的格式: %s", format), nil, false)
	}
}

func (m *Manager) serializeYAML(data map[string]interface{}) ([]byte, *errors.SecfgError) {
	var buf bytes.Buffer
	encoder := yaml.NewEncoder(&buf)
	encoder.SetIndent(2)
	if err := encoder.Encode(data); err != nil {
		return nil, errors.New(errors.E015, err, false)
	}
	return buf.Bytes(), nil
}

func (m *Manager) serializeJSON(data map[string]interface{}) ([]byte, *errors.SecfgError) {
	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return nil, errors.New(errors.E015, err, false)
	}
	return append(content, '\n'), nil
}

func (m *Manager) serializeProperties(data map[string]interface{}) ([]byte, *errors.SecfgError) {
	var lines []string
	for k, v := range data {
		lines = append(lines, fmt.Sprintf("%s=%v", k, v))
	}
	sort.Strings(lines)
	return []byte(strings.Join(lines, "\n") + "\n"), nil
}

func (m *Manager) EncryptConfig(cfg *ConfigData) (int, *errors.SecfgError) {
	if m.vault == nil {
		return 0, errors.NewWithMessage(errors.E003, "Vault未初始化", nil, false)
	}

	count := 0
	err := m.walkAndEncrypt(cfg.Data, "", &count)
	if err != nil {
		return count, err
	}
	return count, nil
}

func (m *Manager) walkAndEncrypt(data interface{}, path string, count *int) *errors.SecfgError {
	switch v := data.(type) {
	case map[string]interface{}:
		for key, val := range v {
			currentPath := key
			if path != "" {
				currentPath = path + "." + key
			}

			if strVal, ok := val.(string); ok {
				if validator.IsSensitiveField(key) && !m.vault.IsEncrypted(strVal) {
					encrypted, err := m.vault.Encrypt(strVal)
					if err != nil {
						return errors.NewWithMessage(errors.E003,
							fmt.Sprintf("加密字段失败: %s", currentPath), err, false)
					}
					v[key] = encrypted
					*count++
				}
			} else {
				if err := m.walkAndEncrypt(val, currentPath, count); err != nil {
					return err
				}
			}
		}
	case []interface{}:
		for i, item := range v {
			currentPath := fmt.Sprintf("%s[%d]", path, i)
			if err := m.walkAndEncrypt(item, currentPath, count); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *Manager) DecryptConfig(cfg *ConfigData) (int, *errors.SecfgError) {
	if m.vault == nil {
		return 0, errors.NewWithMessage(errors.E004, "Vault未初始化", nil, false)
	}

	count := 0
	err := m.walkAndDecrypt(cfg.Data, "", &count)
	if err != nil {
		return count, err
	}
	return count, nil
}

func (m *Manager) walkAndDecrypt(data interface{}, path string, count *int) *errors.SecfgError {
	switch v := data.(type) {
	case map[string]interface{}:
		for key, val := range v {
			currentPath := key
			if path != "" {
				currentPath = path + "." + key
			}

			if strVal, ok := val.(string); ok {
				if m.vault.IsEncrypted(strVal) {
					decrypted, err := m.vault.Decrypt(strVal)
					if err != nil {
						return errors.NewWithMessage(errors.E004,
							fmt.Sprintf("解密字段失败: %s", currentPath), err, false)
					}
					v[key] = decrypted
					*count++
				}
			} else {
				if err := m.walkAndDecrypt(val, currentPath, count); err != nil {
					return err
				}
			}
		}
	case []interface{}:
		for i, item := range v {
			currentPath := fmt.Sprintf("%s[%d]", path, i)
			if err := m.walkAndDecrypt(item, currentPath, count); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *Manager) CompareConfigs(source, target *ConfigData, mappings []FieldMapping) *DiffReport {
	report := &DiffReport{
		SourceEnv: source.Path,
		TargetEnv: target.Path,
	}

	sourceFlat := flattenMap(source.Data, "")
	targetFlat := flattenMap(target.Data, "")

	appliedSource := applyMappings(sourceFlat, mappings)

	for key, val := range appliedSource {
		targetVal, exists := targetFlat[key]
		if !exists {
			report.AddedItems = append(report.AddedItems, DiffItem{
				Path:      key,
				NewValue:  val,
				Operation: "add",
			})
		} else if !valuesEqual(val, targetVal) {
			report.ModifiedItems = append(report.ModifiedItems, DiffItem{
				Path:      key,
				OldValue:  targetVal,
				NewValue:  val,
				Operation: "modify",
			})
		}
	}

	for key, val := range targetFlat {
		if _, exists := appliedSource[key]; !exists {
			report.RemovedItems = append(report.RemovedItems, DiffItem{
				Path:     key,
				OldValue: val,
				Operation: "remove",
			})
		}
	}

	report.TotalChanges = len(report.AddedItems) + len(report.ModifiedItems) + len(report.RemovedItems)

	return report
}

func (m *Manager) ApplyDiff(target *ConfigData, diff *DiffReport) *errors.SecfgError {
	for _, item := range diff.AddedItems {
		setNestedValue(target.Data, item.Path, item.NewValue)
	}

	for _, item := range diff.ModifiedItems {
		setNestedValue(target.Data, item.Path, item.NewValue)
	}

	for _, item := range diff.RemovedItems {
		removeNestedValue(target.Data, item.Path)
	}

	return nil
}

func flattenMap(data map[string]interface{}, prefix string) map[string]interface{} {
	result := make(map[string]interface{})

	for key, val := range data {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		switch v := val.(type) {
		case map[string]interface{}:
			nested := flattenMap(v, fullKey)
			for k, v := range nested {
				result[k] = v
			}
		case []interface{}:
			for i, item := range v {
				arrKey := fmt.Sprintf("%s[%d]", fullKey, i)
				if nested, ok := item.(map[string]interface{}); ok {
					nestedFlat := flattenMap(nested, arrKey)
					for k, v := range nestedFlat {
						result[k] = v
					}
				} else {
					result[arrKey] = item
				}
			}
		default:
			result[fullKey] = val
		}
	}

	return result
}

func applyMappings(data map[string]interface{}, mappings []FieldMapping) map[string]interface{} {
	if len(mappings) == 0 {
		return data
	}

	result := make(map[string]interface{})
	for k, v := range data {
		result[k] = v
	}

	for _, mapping := range mappings {
		if val, exists := result[mapping.SourcePath]; exists {
			delete(result, mapping.SourcePath)
			if mapping.Transform != "" {
				result[mapping.TargetPath] = applyTransform(val, mapping.Transform)
			} else {
				result[mapping.TargetPath] = val
			}
		}
	}

	return result
}

func applyTransform(v interface{}, transform string) interface{} {
	switch strings.ToLower(strings.TrimSpace(transform)) {
	case "toupper":
		if s, ok := v.(string); ok {
			return strings.ToUpper(s)
		}
	case "tolower":
		if s, ok := v.(string); ok {
			return strings.ToLower(s)
		}
	case "trim":
		if s, ok := v.(string); ok {
			return strings.TrimSpace(s)
		}
	case "toint":
		switch n := v.(type) {
		case string:
			if i, err := strconv.Atoi(n); err == nil {
				return i
			}
		case float64:
			return int(n)
		}
	case "tofloat":
		switch n := v.(type) {
		case string:
			if f, err := strconv.ParseFloat(n, 64); err == nil {
				return f
			}
		case int:
			return float64(n)
		}
	case "tostring":
		return fmt.Sprintf("%v", v)
	case "tobool":
		switch b := v.(type) {
		case string:
			lower := strings.ToLower(b)
			return lower == "true" || lower == "1" || lower == "yes"
		case int:
			return b != 0
		}
	case "envprefix":
		if s, ok := v.(string); ok {
			env := os.Getenv(s)
			if env != "" {
				return env
			}
		}
	}
	return v
}

func valuesEqual(a, b interface{}) bool {
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func setNestedValue(data map[string]interface{}, path string, value interface{}) {
	parts := strings.Split(path, ".")
	current := data

	for i, part := range parts {
		if i == len(parts)-1 {
			if idx, isArray := parseArrayIndex(part); isArray {
				if arr, ok := current[parts[i-1]].([]interface{}); ok {
					for idx >= len(arr) {
						arr = append(arr, nil)
					}
					arr[idx] = value
					current[parts[i-1]] = arr
				}
			} else {
				current[part] = value
			}
			return
		}

		if idx, isArray := parseArrayIndex(part); isArray {
			arrKey := parts[i-1]
			if _, exists := current[arrKey]; !exists {
				current[arrKey] = make([]interface{}, 0)
			}
			if arr, ok := current[arrKey].([]interface{}); ok {
				for idx >= len(arr) {
					arr = append(arr, make(map[string]interface{}))
				}
				if _, ok := arr[idx].(map[string]interface{}); !ok {
					arr[idx] = make(map[string]interface{})
				}
				current = arr[idx].(map[string]interface{})
				current[arrKey] = arr
			}
		} else {
			if _, exists := current[part]; !exists {
				current[part] = make(map[string]interface{})
			}
			if nested, ok := current[part].(map[string]interface{}); ok {
				current = nested
			}
		}
	}
}

func removeNestedValue(data map[string]interface{}, path string) {
	parts := strings.Split(path, ".")
	current := data

	for i, part := range parts {
		if i == len(parts)-1 {
			if idx, isArray := parseArrayIndex(part); isArray {
				if arr, ok := current[parts[i-1]].([]interface{}); ok && idx < len(arr) {
					current[parts[i-1]] = append(arr[:idx], arr[idx+1:]...)
				}
			} else {
				delete(current, part)
			}
			return
		}

		if idx, isArray := parseArrayIndex(part); isArray {
			arrKey := parts[i-1]
			if arr, ok := current[arrKey].([]interface{}); ok && idx < len(arr) {
				if nested, ok := arr[idx].(map[string]interface{}); ok {
					current = nested
				}
			}
		} else {
			if nested, ok := current[part].(map[string]interface{}); ok {
				current = nested
			} else {
				return
			}
		}
	}
}

func parseArrayIndex(part string) (int, bool) {
	if strings.HasPrefix(part, "[") && strings.HasSuffix(part, "]") {
		var idx int
		if _, err := fmt.Sscanf(part, "[%d]", &idx); err == nil {
			return idx, true
		}
	}
	return 0, false
}

func (m *Manager) FindConfigFiles(dir string, recursive bool) ([]string, *errors.SecfgError) {
	if err := validator.ValidateDirectoryPath(dir); err != nil {
		return nil, err
	}

	var files []string
	extensions := map[string]bool{
		".yaml":       true,
		".yml":        true,
		".json":       true,
		".properties": true,
		".props":      true,
		".prop":       true,
	}

	walkFn := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if !recursive && path != dir {
				return filepath.SkipDir
			}
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if extensions[ext] {
			files = append(files, path)
		}
		return nil
	}

	if err := filepath.Walk(dir, walkFn); err != nil {
		return nil, errors.New(errors.E014, err, false)
	}

	return files, nil
}
