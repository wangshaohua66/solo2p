package models

type UserRole string

const (
	RoleAdmin       UserRole = "admin"
	RoleOperator    UserRole = "operator"
	RoleOrganizer   UserRole = "organizer"
	RoleExhibitor   UserRole = "exhibitor"
	RoleBuilder     UserRole = "builder"
	RoleProvider    UserRole = "provider"
	RoleVisitor     UserRole = "visitor"
)

type User struct {
	BaseModel
	Username    string            `json:"username" gorm:"uniqueIndex;size:50;not null" example:"admin"`
	Password    string            `json:"-" gorm:"size:255;not null"`
	Name        string            `json:"name" gorm:"size:100" example:"系统管理员"`
	Email       string            `json:"email" gorm:"size:100" example:"admin@exhibition.com"`
	Phone       string            `json:"phone" gorm:"size:20" example:"13800138000"`
	Role        UserRole          `json:"role" gorm:"size:20;not null" example:"admin"`
	Permissions map[string]bool   `json:"permissions" gorm:"type:jsonb"`
	AvatarURL   string            `json:"avatarUrl" gorm:"size:500"`
	Status      string            `json:"status" gorm:"size:20;default:active" example:"active"`
}

func (User) TableName() string {
	return "users"
}
