package config

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Redis     RedisConfig     `yaml:"redis"`
	Platforms PlatformConfig  `yaml:"platforms"`
	JWT       JWTConfig       `yaml:"jwt"`
}

type ServerConfig struct {
	Port         int    `yaml:"port"`
	ReadTimeout  int    `yaml:"read_timeout"`
	WriteTimeout int    `yaml:"write_timeout"`
	CORSOrigins  string `yaml:"cors_origins"`
}

type RedisConfig struct {
	Addr     string `yaml:"addr"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
}

type PlatformConfig struct {
	NetEase   PlatformAuth `yaml:"netease"`
	QQMusic   PlatformAuth `yaml:"qqmusic"`
	Kugou     PlatformAuth `yaml:"kugou"`
	Kuwo      PlatformAuth `yaml:"kuwo"`
	Spotify   PlatformAuth `yaml:"spotify"`
	AppleMusic PlatformAuth `yaml:"apple_music"`
}

type PlatformAuth struct {
	APIKey    string `yaml:"api_key"`
	APISecret string `yaml:"api_secret"`
	BaseURL   string `yaml:"base_url"`
	Enabled   bool   `yaml:"enabled"`
}

type JWTConfig struct {
	Secret     string `yaml:"secret"`
	ExpireHours int   `yaml:"expire_hours"`
	Issuer     string `yaml:"issuer"`
}
