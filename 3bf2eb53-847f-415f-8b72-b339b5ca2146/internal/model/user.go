package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserRole string

const (
	RoleAdmin           UserRole = "admin"
	RoleOpsManager      UserRole = "ops_manager"
	RoleEngineer        UserRole = "engineer"
	RoleShipDispatcher  UserRole = "ship_dispatcher"
	RoleSafetyOfficer   UserRole = "safety_officer"
)

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Username     string             `bson:"username" json:"username" validate:"required,min=3,max=50"`
	PasswordHash string             `bson:"password_hash" json:"-"`
	RealName     string             `bson:"real_name" json:"real_name" validate:"required"`
	Email        string             `bson:"email" json:"email" validate:"required,email"`
	Phone        string             `bson:"phone" json:"phone" validate:"required"`
	Role         UserRole           `bson:"role" json:"role" validate:"required"`
	WindFarmIDs  []string           `bson:"wind_farm_ids" json:"wind_farm_ids"`
	Status       string             `bson:"status" json:"status"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         *User     `json:"user"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}
