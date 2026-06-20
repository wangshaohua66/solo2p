package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/labelops/backend/internal/config"
)

type RedisStore struct {
	client *redis.Client
}

func NewRedisStore(cfg *config.RedisConfig) *RedisStore {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
		PoolSize: cfg.PoolSize,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Printf("Warning: Redis ping failed: %v, proceeding with mock store\n", err)
	}

	return &RedisStore{client: rdb}
}

func (r *RedisStore) Client() *redis.Client {
	return r.client
}

func (r *RedisStore) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	data, err := r.client.Get(ctx, key).Bytes()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if dest != nil {
		if err := json.Unmarshal(data, dest); err != nil {
			return false, err
		}
	}
	return true, nil
}

func (r *RedisStore) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *RedisStore) Delete(ctx context.Context, keys ...string) error {
	return r.client.Del(ctx, keys...).Err()
}

func (r *RedisStore) Exists(ctx context.Context, key string) (bool, error) {
	n, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}
	return n > 0, nil
}

func (r *RedisStore) HGet(ctx context.Context, key, field string, dest interface{}) (bool, error) {
	data, err := r.client.HGet(ctx, key, field).Bytes()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if dest != nil {
		if err := json.Unmarshal(data, dest); err != nil {
			return false, err
		}
	}
	return true, nil
}

func (r *RedisStore) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	pipe := r.client.Pipeline()
	for field, val := range values {
		data, err := json.Marshal(val)
		if err != nil {
			return err
		}
		pipe.HSet(ctx, key, field, data)
	}
	_, err := pipe.Exec(ctx)
	return err
}

func (r *RedisStore) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	return r.client.HGetAll(ctx, key).Result()
}

func (r *RedisStore) ZAdd(ctx context.Context, key string, score float64, member string) error {
	return r.client.ZAdd(ctx, key, redis.Z{Score: score, Member: member}).Err()
}

func (r *RedisStore) ZRangeByScore(ctx context.Context, key string, min, max float64, offset, count int64) ([]string, error) {
	return r.client.ZRangeByScore(ctx, key, &redis.ZRangeBy{
		Min:    fmt.Sprintf("%f", min),
		Max:    fmt.Sprintf("%f", max),
		Offset: offset,
		Count:  count,
	}).Result()
}

func (r *RedisStore) ZRevRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return r.client.ZRevRange(ctx, key, start, stop).Result()
}

func (r *RedisStore) IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	return r.client.IncrBy(ctx, key, value).Result()
}

func (r *RedisStore) LPush(ctx context.Context, key string, values ...interface{}) error {
	return r.client.LPush(ctx, key, values...).Err()
}

func (r *RedisStore) LRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	return r.client.LRange(ctx, key, start, stop).Result()
}

func (r *RedisStore) Keys(ctx context.Context, pattern string) ([]string, error) {
	return r.client.Keys(ctx, pattern).Result()
}

func (r *RedisStore) AcquireLock(ctx context.Context, key string, ttl time.Duration) (bool, string, error) {
	token := fmt.Sprintf("lock-%d", time.Now().UnixNano())
	ok, err := r.client.SetNX(ctx, key, token, ttl).Result()
	if err != nil {
		return false, "", err
	}
	return ok, token, nil
}

func (r *RedisStore) ReleaseLock(ctx context.Context, key, token string) error {
	script := redis.NewScript(`
		if redis.call("GET", KEYS[1]) == ARGV[1] then
			return redis.call("DEL", KEYS[1])
		else
			return 0
		end
	`)
	return script.Run(ctx, r.client, []string{key}, token).Err()
}

const (
	KeyWorkPrefix          = "work:"
	KeyWorkList            = "work:list"
	KeyWorkVersionPrefix   = "work:version:"
	KeyArtistPrefix        = "artist:"
	KeyArtistList          = "artist:list"
	KeyUserPrefix          = "user:"
	KeyUsernameIndex       = "user:username:"
	KeyRoyaltyRulePrefix   = "royalty:rule:"
	KeyPlatformDataPrefix  = "platform:data:"
	KeySettlementPrefix    = "settlement:"
	KeySettlementList      = "settlement:list"
	KeyPiracyPrefix        = "piracy:"
	KeyPiracyList          = "piracy:list"
	KeyAuditLogPrefix      = "audit:"
	KeyDashboardCache      = "dashboard:cache:"
)

func KeyWork(id string) string          { return KeyWorkPrefix + id }
func KeyArtist(id string) string        { return KeyArtistPrefix + id }
func KeyUser(id string) string          { return KeyUserPrefix + id }
func KeyUserByUsername(u string) string { return KeyUsernameIndex + u }
func KeyRoyaltyRule(id string) string   { return KeyRoyaltyRulePrefix + id }
func KeySettlement(id string) string    { return KeySettlementPrefix + id }
func KeyPiracy(id string) string        { return KeyPiracyPrefix + id }
func KeyWorkVersions(workID string) string { return KeyWorkVersionPrefix + workID }
func KeyPlatformData(date string, p PlatformKey) string {
	return KeyPlatformDataPrefix + string(p) + ":" + date
}

type PlatformKey string

const (
	PlatformKeyNetEase    PlatformKey = "netease"
	PlatformKeyQQMusic    PlatformKey = "qqmusic"
	PlatformKeyKugou      PlatformKey = "kugou"
	PlatformKeyKuwo       PlatformKey = "kuwo"
	PlatformKeySpotify    PlatformKey = "spotify"
	PlatformKeyAppleMusic PlatformKey = "apple_music"
)
