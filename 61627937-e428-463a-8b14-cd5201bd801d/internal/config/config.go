package config

import (
	"encoding/json"
	"os"
	"path/filepath"

	"copyright-monitor/internal/models"
)

type Config struct {
	DatabasePath    string  `json:"database_path"`
	LogPath         string  `json:"log_path"`
	EvidenceDir     string  `json:"evidence_dir"`
	SimThreshold    float64 `json:"sim_threshold"`
	MaxConcurrency  int     `json:"max_concurrency"`
	RequestTimeout  int     `json:"request_timeout"`
	MaxRetries      int     `json:"max_retries"`
	LogRetentionDays int    `json:"log_retention_days"`
	UserAgent       string  `json:"user_agent"`
}

var defaultConfig = Config{
	DatabasePath:    "data/copyright.db",
	LogPath:         "logs",
	EvidenceDir:     "data/evidence",
	SimThreshold:    80.0,
	MaxConcurrency:  15,
	RequestTimeout:  30,
	MaxRetries:      3,
	LogRetentionDays: 30,
	UserAgent:       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

var appConfig Config

func Load(configPath string) (*Config, error) {
	if configPath == "" {
		appConfig = defaultConfig
		return &appConfig, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			appConfig = defaultConfig
			return &appConfig, nil
		}
		return nil, err
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	appConfig = mergeWithDefaults(cfg)
	return &appConfig, nil
}

func mergeWithDefaults(cfg Config) Config {
	if cfg.DatabasePath == "" {
		cfg.DatabasePath = defaultConfig.DatabasePath
	}
	if cfg.LogPath == "" {
		cfg.LogPath = defaultConfig.LogPath
	}
	if cfg.EvidenceDir == "" {
		cfg.EvidenceDir = defaultConfig.EvidenceDir
	}
	if cfg.SimThreshold == 0 {
		cfg.SimThreshold = defaultConfig.SimThreshold
	}
	if cfg.MaxConcurrency == 0 {
		cfg.MaxConcurrency = defaultConfig.MaxConcurrency
	}
	if cfg.RequestTimeout == 0 {
		cfg.RequestTimeout = defaultConfig.RequestTimeout
	}
	if cfg.MaxRetries == 0 {
		cfg.MaxRetries = defaultConfig.MaxRetries
	}
	if cfg.LogRetentionDays == 0 {
		cfg.LogRetentionDays = defaultConfig.LogRetentionDays
	}
	if cfg.UserAgent == "" {
		cfg.UserAgent = defaultConfig.UserAgent
	}
	return cfg
}

func Get() *Config {
	return &appConfig
}

func GetDefaultPlatforms() []models.PlatformSource {
	return []models.PlatformSource{
		{
			Name:           "省新闻门户",
			Type:           models.PlatformNews,
			BaseURL:        "https://news.example.com",
			ListURLPattern: "https://news.example.com/list?page={page}",
			ListSelector:   ".news-list .news-item",
			DetailSelector: "a.title",
			TitleSelector:  "h1.article-title",
			ContentSelector: ".article-content",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "都市新闻网",
			Type:           models.PlatformNews,
			BaseURL:        "https://city.example.com",
			ListURLPattern: "https://city.example.com/news?page={page}",
			ListSelector:   ".list-container .item",
			DetailSelector: "a.link",
			TitleSelector:  ".article h1",
			ContentSelector: ".article-body",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "财经日报",
			Type:           models.PlatformNews,
			BaseURL:        "https://finance.example.com",
			ListURLPattern: "https://finance.example.com/latest?page={page}",
			ListSelector:   ".news-items .item",
			DetailSelector: "a.headline",
			TitleSelector:  "h1.story-title",
			ContentSelector: ".story-content",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "科技资讯",
			Type:           models.PlatformNews,
			BaseURL:        "https://tech.example.com",
			ListURLPattern: "https://tech.example.com/articles?page={page}",
			ListSelector:   ".article-list .card",
			DetailSelector: "a.article-link",
			TitleSelector:  "h1.page-title",
			ContentSelector: ".article-text",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "文化周刊",
			Type:           models.PlatformNews,
			BaseURL:        "https://culture.example.com",
			ListURLPattern: "https://culture.example.com/features?page={page}",
			ListSelector:   ".feature-list .feature-item",
			DetailSelector: "a.feature-link",
			TitleSelector:  "h1.feature-title",
			ContentSelector: ".feature-body",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "本地头条",
			Type:           models.PlatformNews,
			BaseURL:        "https://local.example.com",
			ListURLPattern: "https://local.example.com/top?page={page}",
			ListSelector:   ".top-list .top-item",
			DetailSelector: "a.item-link",
			TitleSelector:  "h1.news-title",
			ContentSelector: ".news-body",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "优视频",
			Type:           models.PlatformVideo,
			BaseURL:        "https://video1.example.com",
			ListURLPattern: "https://video1.example.com/hot?page={page}",
			ListSelector:   ".video-list .video-card",
			DetailSelector: "a.video-link",
			TitleSelector:  "h1.video-title",
			ContentSelector: ".video-desc",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "快视频",
			Type:           models.PlatformVideo,
			BaseURL:        "https://video2.example.com",
			ListURLPattern: "https://video2.example.com/trending?page={page}",
			ListSelector:   ".trending-list .video-item",
			DetailSelector: "a.thumb-link",
			TitleSelector:  ".info h1",
			ContentSelector: ".description",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "番茄视频",
			Type:           models.PlatformVideo,
			BaseURL:        "https://video3.example.com",
			ListURLPattern: "https://video3.example.com/recommend?page={page}",
			ListSelector:   ".recommend-list .card",
			DetailSelector: "a.play-link",
			TitleSelector:  "h1.title",
			ContentSelector: ".desc-content",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "芒果TV",
			Type:           models.PlatformVideo,
			BaseURL:        "https://video4.example.com",
			ListURLPattern: "https://video4.example.com/variety?page={page}",
			ListSelector:   ".variety-list .item",
			DetailSelector: "a.cover",
			TitleSelector:  ".main-title",
			ContentSelector: ".summary",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "B站",
			Type:           models.PlatformVideo,
			BaseURL:        "https://video5.example.com",
			ListURLPattern: "https://video5.example.com/ranking?page={page}",
			ListSelector:   ".rank-list .video-item",
			DetailSelector: "a.title-link",
			TitleSelector:  "h1.video-title",
			ContentSelector: ".video-info-desc",
			RequestDelay:   3,
			MaxConcurrency: 2,
			Enabled:        true,
		},
		{
			Name:           "短视频平台",
			Type:           models.PlatformVideo,
			BaseURL:        "https://short.example.com",
			ListURLPattern: "https://short.example.com/discover?page={page}",
			ListSelector:   ".video-feed .feed-item",
			DetailSelector: "a.author-link",
			TitleSelector:  ".video-caption",
			ContentSelector: ".video-desc-text",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "网音乐",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music1.example.com",
			ListURLPattern: "https://music1.example.com/playlist?page={page}",
			ListSelector:   ".song-list .song-item",
			DetailSelector: "a.song-link",
			TitleSelector:  ".song-title",
			ContentSelector: ".lyric-content",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "QQ音乐",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music2.example.com",
			ListURLPattern: "https://music2.example.com/toplist?page={page}",
			ListSelector:   ".top-list .list-item",
			DetailSelector: "a.song-name",
			TitleSelector:  ".song-header h1",
			ContentSelector: ".lyric-text",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "酷狗音乐",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music3.example.com",
			ListURLPattern: "https://music3.example.com/new?page={page}",
			ListSelector:   ".new-songs .song",
			DetailSelector: "a.name",
			TitleSelector:  ".player-title",
			ContentSelector: ".lyrics-container",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "酷我音乐",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music4.example.com",
			ListURLPattern: "https://music4.example.com/rank?page={page}",
			ListSelector:   ".rank-board .rank-item",
			DetailSelector: "a.song-title",
			TitleSelector:  ".song-name",
			ContentSelector: ".geci-content",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "咪咕音乐",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music5.example.com",
			ListURLPattern: "https://music5.example.com/charts?page={page}",
			ListSelector:   ".chart-list .chart-item",
			DetailSelector: "a.track-name",
			TitleSelector:  ".track-title",
			ContentSelector: ".lyrics-display",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
		{
			Name:           "5sing原创",
			Type:           models.PlatformMusic,
			BaseURL:        "https://music6.example.com",
			ListURLPattern: "https://music6.example.com/original?page={page}",
			ListSelector:   ".original-list .music-item",
			DetailSelector: "a.music-title",
			TitleSelector:  ".music-header h2",
			ContentSelector: ".music-lyrics",
			RequestDelay:   2,
			MaxConcurrency: 3,
			Enabled:        true,
		},
	}
}

func EnsureDirs() error {
	dirs := []string{
		filepath.Dir(appConfig.DatabasePath),
		appConfig.LogPath,
		appConfig.EvidenceDir,
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	return nil
}
