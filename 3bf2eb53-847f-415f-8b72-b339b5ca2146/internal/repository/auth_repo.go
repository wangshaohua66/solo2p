package repository

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type RefreshToken struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Token     string             `bson:"token"`
	UserID    string             `bson:"user_id"`
	ExpiresAt time.Time          `bson:"expires_at"`
	CreatedAt time.Time          `bson:"created_at"`
}

type AuthRepository struct {
	tokenColl *mongo.Collection
}

func NewAuthRepository(db *mongo.Database) *AuthRepository {
	return &AuthRepository{
		tokenColl: db.Collection(CollectionRefreshTokens),
	}
}

func (r *AuthRepository) SaveRefreshToken(ctx context.Context, token string, userID string, expiresAt time.Time) error {
	doc := RefreshToken{
		Token:     token,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	_, err := r.tokenColl.InsertOne(ctx, doc)
	return err
}

func (r *AuthRepository) GetRefreshToken(ctx context.Context, token string) (*RefreshToken, error) {
	var rt RefreshToken
	err := r.tokenColl.FindOne(ctx, bson.M{"token": token}).Decode(&rt)
	if err != nil {
		return nil, err
	}
	return &rt, nil
}

func (r *AuthRepository) DeleteRefreshToken(ctx context.Context, token string) error {
	_, err := r.tokenColl.DeleteOne(ctx, bson.M{"token": token})
	return err
}

func (r *AuthRepository) DeleteByUserID(ctx context.Context, userID string) error {
	_, err := r.tokenColl.DeleteMany(ctx, bson.M{"user_id": userID})
	return err
}

func (r *AuthRepository) CleanExpired(ctx context.Context) (int64, error) {
	result, err := r.tokenColl.DeleteMany(ctx, bson.M{
		"expires_at": bson.M{"$lt": time.Now()},
	})
	if err != nil {
		return 0, err
	}
	return result.DeletedCount, nil
}
