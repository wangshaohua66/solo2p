package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"time"

	"secfg/internal/errors"
	"secfg/internal/validator"
)

const (
	KeySize         = 32
	NonceSize       = 12
	EncryptedPrefix = "ENC[AES256-GCM:"
	EncryptedSuffix = "]"
)

type KeyMetadata struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"created_at"`
	Version   int       `json:"version"`
	Active    bool      `json:"active"`
}

type KeyStore struct {
	Keys        map[string][]byte      `json:"-"`
	Metadata    map[string]KeyMetadata `json:"metadata"`
	CurrentKey  string                 `json:"current_key"`
	basePath    string
	keyFilePath string
}

type Vault struct {
	keyStore *KeyStore
}

func NewVault(basePath string) (*Vault, *errors.SecfgError) {
	store := &KeyStore{
		Keys:     make(map[string][]byte),
		Metadata: make(map[string]KeyMetadata),
		basePath: basePath,
	}

	if err := os.MkdirAll(basePath, 0700); err != nil {
		return nil, errors.New(errors.E002, err, false)
	}

	store.keyFilePath = filepath.Join(basePath, "master.key")

	v := &Vault{keyStore: store}

	if _, err := os.Stat(store.keyFilePath); err == nil {
		if err := v.loadKeyStore(); err != nil {
			return nil, err
		}
	}

	return v, nil
}

func (v *Vault) GenerateKey() (string, *errors.SecfgError) {
	key, err := validator.GenerateStrongKey(KeySize)
	if err != nil {
		return "", err
	}

	keyID := generateKeyID()
	version := v.getNextVersion()

	v.keyStore.Keys[keyID] = key
	v.keyStore.Metadata[keyID] = KeyMetadata{
		ID:        keyID,
		CreatedAt: time.Now(),
		Version:   version,
		Active:    true,
	}

	for id, meta := range v.keyStore.Metadata {
		if id != keyID {
			meta.Active = false
			v.keyStore.Metadata[id] = meta
		}
	}

	v.keyStore.CurrentKey = keyID

	if err := v.saveKeyStore(); err != nil {
		return "", err
	}

	return keyID, nil
}

func (v *Vault) RotateKey() (string, *errors.SecfgError) {
	if v.keyStore.CurrentKey == "" {
		return "", errors.NewWithMessage(errors.E005, "没有可用的密钥，先生成主密钥", nil, false)
	}

	if err := v.backupOldKeys(); err != nil {
		return "", err
	}

	return v.GenerateKey()
}

func (v *Vault) backupOldKeys() *errors.SecfgError {
	backupDir := filepath.Join(v.keyStore.basePath, "key_backups")
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return errors.New(errors.E009, err, false)
	}

	timestamp := time.Now().Format("20060102_150405")
	backupFile := filepath.Join(backupDir, fmt.Sprintf("keys_backup_%s.json", timestamp))

	type BackupEntry struct {
		KeyID     string    `json:"key_id"`
		Key       string    `json:"key"`
		Metadata  KeyMetadata `json:"metadata"`
	}

	var backup []BackupEntry
	for id, key := range v.keyStore.Keys {
		backup = append(backup, BackupEntry{
			KeyID:    id,
			Key:      base64.StdEncoding.EncodeToString(key),
			Metadata: v.keyStore.Metadata[id],
		})
	}

	sort.Slice(backup, func(i, j int) bool {
		return backup[i].Metadata.Version < backup[j].Metadata.Version
	})

	data, err := json.MarshalIndent(backup, "", "  ")
	if err != nil {
		return errors.New(errors.E009, err, false)
	}

	if err := os.WriteFile(backupFile, data, 0600); err != nil {
		return errors.New(errors.E009, err, false)
	}

	return nil
}

func (v *Vault) Encrypt(plaintext string) (string, *errors.SecfgError) {
	key, err := v.getCurrentKey()
	if err != nil {
		return "", err
	}

	block, stdErr := aes.NewCipher(key)
	if stdErr != nil {
		return "", errors.New(errors.E003, stdErr, false)
	}

	gcm, stdErr := cipher.NewGCM(block)
	if stdErr != nil {
		return "", errors.New(errors.E003, stdErr, false)
	}

	nonce := make([]byte, NonceSize)
	if _, stdErr := io.ReadFull(rand.Reader, nonce); stdErr != nil {
		return "", errors.New(errors.E003, stdErr, false)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	encoded := base64.StdEncoding.EncodeToString(ciphertext)

	return fmt.Sprintf("%s%s%s", EncryptedPrefix, encoded, EncryptedSuffix), nil
}

func (v *Vault) Decrypt(encrypted string) (string, *errors.SecfgError) {
	if !v.IsEncrypted(encrypted) {
		return encrypted, nil
	}

	encoded := encrypted[len(EncryptedPrefix) : len(encrypted)-len(EncryptedSuffix)]
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", errors.NewWithMessage(errors.E004, "加密数据格式错误", err, false)
	}

	if len(ciphertext) < NonceSize {
		return "", errors.NewWithMessage(errors.E004, "加密数据长度不足", nil, false)
	}

	nonce := ciphertext[:NonceSize]
	actualCiphertext := ciphertext[NonceSize:]

	var lastErr *errors.SecfgError
	for keyID, key := range v.keyStore.Keys {
		block, stdErr := aes.NewCipher(key)
		if stdErr != nil {
			lastErr = errors.New(errors.E004, stdErr, false)
			continue
		}

		gcm, stdErr := cipher.NewGCM(block)
		if stdErr != nil {
			lastErr = errors.New(errors.E004, stdErr, false)
			continue
		}

		plaintext, stdErr := gcm.Open(nil, nonce, actualCiphertext, nil)
		if stdErr == nil {
			if keyID != v.keyStore.CurrentKey {
				meta := v.keyStore.Metadata[keyID]
				fmt.Printf("\033[33m警告: 使用旧密钥 v%d 解密，请考虑重新加密\033[0m\n", meta.Version)
			}
			return string(plaintext), nil
		}
		lastErr = errors.New(errors.E004, stdErr, false)
	}

	if lastErr == nil {
		return "", errors.NewWithMessage(errors.E004, "没有可用的密钥进行解密", nil, false)
	}

	return "", lastErr
}

func (v *Vault) IsEncrypted(value string) bool {
	return len(value) > len(EncryptedPrefix)+len(EncryptedSuffix) &&
		value[:len(EncryptedPrefix)] == EncryptedPrefix &&
		value[len(value)-len(EncryptedSuffix):] == EncryptedSuffix
}

func (v *Vault) getCurrentKey() ([]byte, *errors.SecfgError) {
	if v.keyStore.CurrentKey == "" {
		return nil, errors.NewWithMessage(errors.E005, "主密钥不存在，请先生成密钥", nil, false)
	}

	key, exists := v.keyStore.Keys[v.keyStore.CurrentKey]
	if !exists {
		return nil, errors.NewWithMessage(errors.E005, "当前密钥不存在", nil, false)
	}

	return key, nil
}

func (v *Vault) getNextVersion() int {
	maxVersion := 0
	for _, meta := range v.keyStore.Metadata {
		if meta.Version > maxVersion {
			maxVersion = meta.Version
		}
	}
	return maxVersion + 1
}

func generateKeyID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("k_%x", b)
}

func (v *Vault) saveKeyStore() *errors.SecfgError {
	type keyStoreData struct {
		Metadata   map[string]KeyMetadata `json:"metadata"`
		CurrentKey string                 `json:"current_key"`
		Keys       map[string]string      `json:"keys"`
	}

	data := keyStoreData{
		Metadata:   v.keyStore.Metadata,
		CurrentKey: v.keyStore.CurrentKey,
		Keys:       make(map[string]string),
	}

	for id, key := range v.keyStore.Keys {
		data.Keys[id] = base64.StdEncoding.EncodeToString(key)
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return errors.New(errors.E002, err, false)
	}

	if err := os.WriteFile(v.keyStore.keyFilePath, jsonData, 0600); err != nil {
		return errors.New(errors.E002, err, false)
	}

	return nil
}

func (v *Vault) loadKeyStore() *errors.SecfgError {
	if err := validator.ValidateKeyFilePermissions(v.keyStore.keyFilePath); err != nil {
		return err
	}

	data, err := os.ReadFile(v.keyStore.keyFilePath)
	if err != nil {
		return errors.New(errors.E002, err, false)
	}

	type keyStoreData struct {
		Metadata   map[string]KeyMetadata `json:"metadata"`
		CurrentKey string                 `json:"current_key"`
		Keys       map[string]string      `json:"keys"`
	}

	var storeData keyStoreData
	if err := json.Unmarshal(data, &storeData); err != nil {
		return errors.New(errors.E002, err, false)
	}

	v.keyStore.Metadata = storeData.Metadata
	v.keyStore.CurrentKey = storeData.CurrentKey

	for id, encodedKey := range storeData.Keys {
		key, err := base64.StdEncoding.DecodeString(encodedKey)
		if err != nil {
			return errors.New(errors.E002, err, false)
		}
		v.keyStore.Keys[id] = key
	}

	return nil
}

func (v *Vault) ExportKey(keyID, outputPath string) *errors.SecfgError {
	key, exists := v.keyStore.Keys[keyID]
	if !exists {
		return errors.NewWithMessage(errors.E005, fmt.Sprintf("密钥不存在: %s", keyID), nil, false)
	}

	encoded := base64.StdEncoding.EncodeToString(key)
	if err := os.WriteFile(outputPath, []byte(encoded), 0600); err != nil {
		return errors.New(errors.E002, err, false)
	}

	return nil
}

func (v *Vault) ImportKey(inputPath string) (string, *errors.SecfgError) {
	if err := validator.ValidateConfigPath(inputPath); err != nil {
		return "", err
	}

	encoded, err := os.ReadFile(inputPath)
	if err != nil {
		return "", errors.New(errors.E014, err, false)
	}

	key, err := base64.StdEncoding.DecodeString(string(encoded))
	if err != nil {
		return "", errors.NewWithMessage(errors.E005, "密钥文件格式错误，需要base64编码", err, false)
	}

	if err := validator.ValidateKeyStrength(key); err != nil {
		return "", err
	}

	keyID := generateKeyID()
	version := v.getNextVersion()

	v.keyStore.Keys[keyID] = key
	v.keyStore.Metadata[keyID] = KeyMetadata{
		ID:        keyID,
		CreatedAt: time.Now(),
		Version:   version,
		Active:    true,
	}

	for id, meta := range v.keyStore.Metadata {
		if id != keyID {
			meta.Active = false
			v.keyStore.Metadata[id] = meta
		}
	}

	v.keyStore.CurrentKey = keyID

	if err := v.saveKeyStore(); err != nil {
		return "", err
	}

	return keyID, nil
}

func (v *Vault) ListKeys() []KeyMetadata {
	var keys []KeyMetadata
	for _, meta := range v.keyStore.Metadata {
		keys = append(keys, meta)
	}
	sort.Slice(keys, func(i, j int) bool {
		return keys[i].Version < keys[j].Version
	})
	return keys
}

func (v *Vault) GetCurrentKeyID() string {
	return v.keyStore.CurrentKey
}

func DeriveKeyFromPassword(password string, salt []byte) []byte {
	h := sha256.New()
	h.Write(salt)
	h.Write([]byte(password))
	return h.Sum(nil)
}
