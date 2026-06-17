package utils

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"
)

const (
	rsaKeySize    = 2048
	privateKeyFile = "certs/private_key.pem"
	publicKeyFile  = "certs/public_key.pem"
)

var (
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	keyOnce    sync.Once
	keyInitErr error
)

func initKeys() {
	keyOnce.Do(func() {
		if err := os.MkdirAll("certs", 0755); err != nil {
			keyInitErr = err
			return
		}
		if _, err := os.Stat(privateKeyFile); errors.Is(err, os.ErrNotExist) {
			if err := generateAndSaveKeys(); err != nil {
				keyInitErr = err
				return
			}
		}
		priv, err := loadPrivateKey()
		if err != nil {
			keyInitErr = err
			return
		}
		pub, err := loadPublicKey()
		if err != nil {
			keyInitErr = err
			return
		}
		privateKey = priv
		publicKey = pub
	})
}

func generateAndSaveKeys() error {
	priv, err := rsa.GenerateKey(rand.Reader, rsaKeySize)
	if err != nil {
		return fmt.Errorf("generate rsa key failed: %v", err)
	}
	privBytes := x509.MarshalPKCS1PrivateKey(priv)
	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privBytes,
	})
	if err := os.WriteFile(privateKeyFile, privPEM, 0600); err != nil {
		return fmt.Errorf("save private key failed: %v", err)
	}

	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return fmt.Errorf("marshal public key failed: %v", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: pubBytes,
	})
	if err := os.WriteFile(publicKeyFile, pubPEM, 0644); err != nil {
		return fmt.Errorf("save public key failed: %v", err)
	}
	return nil
}

func loadPrivateKey() (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(privateKeyFile)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "RSA PRIVATE KEY" {
		return nil, errors.New("invalid private key PEM")
	}
	return x509.ParsePKCS1PrivateKey(block.Bytes)
}

func loadPublicKey() (*rsa.PublicKey, error) {
	data, err := os.ReadFile(publicKeyFile)
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "RSA PUBLIC KEY" {
		return nil, errors.New("invalid public key PEM")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not RSA public key")
	}
	return rsaPub, nil
}

func RSASign(content string) (string, error) {
	initKeys()
	if keyInitErr != nil {
		return "", keyInitErr
	}
	hashed := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("rsa sign failed: %v", err)
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func RSAVerify(content, signature string) (bool, error) {
	initKeys()
	if keyInitErr != nil {
		return false, keyInitErr
	}
	sigBytes, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return false, fmt.Errorf("decode signature failed: %v", err)
	}
	hashed := sha256.Sum256([]byte(content))
	err = rsa.VerifyPKCS1v15(publicKey, crypto.SHA256, hashed[:], sigBytes)
	if err != nil {
		return false, nil
	}
	return true, nil
}

func GenerateReportSignature(reportNo string, sampleID uint, reportTime time.Time) (string, string, error) {
	content := fmt.Sprintf("%s|%d|%s", reportNo, sampleID, reportTime.Format("20060102150405"))
	sig, err := RSASign(content)
	if err != nil {
		return "", "", err
	}
	return content, sig, nil
}
