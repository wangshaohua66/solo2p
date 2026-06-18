package config

type Config struct {
	Server   ServerConfig   `json:"server"`
	Database DatabaseConfig `json:"database"`
}

type ServerConfig struct {
	Port string `json:"port"`
}

type DatabaseConfig struct {
	URI      string `json:"uri"`
	Database string `json:"database"`
}

func LoadConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port: "8080",
		},
		Database: DatabaseConfig{
			URI:      "mongodb://localhost:27017",
			Database: "fishery_db",
		},
	}
}
