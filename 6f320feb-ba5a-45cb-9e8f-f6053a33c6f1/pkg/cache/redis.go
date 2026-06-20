package cache

import (
	"context"
	"equipment-trading-platform/internal/config"
	"equipment-trading-platform/pkg/logger"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

func Init(cfg *config.RedisConfig) error {
	Client = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := Client.Ping(ctx).Result(); err != nil {
		return fmt.Errorf("connect redis failed: %w", err)
	}

	logger.Info("redis initialized successfully")
	return nil
}

func GetClient() *redis.Client {
	return Client
}

func Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return Client.Set(ctx, key, value, expiration).Err()
}

func Get(ctx context.Context, key string) (string, error) {
	return Client.Get(ctx, key).Result()
}

func Del(ctx context.Context, keys ...string) error {
	return Client.Del(ctx, keys...).Err()
}

func Exists(ctx context.Context, key string) (bool, error) {
	result, err := Client.Exists(ctx, key).Result()
	return result > 0, err
}

func SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return Client.SetNX(ctx, key, value, expiration).Result()
}
