package model

import "time"

type WorkStatus string

const (
	WorkStatusDemo       WorkStatus = "demo"
	WorkStatusArranging  WorkStatus = "arranging"
	WorkStatusMixing     WorkStatus = "mixing"
	WorkStatusMastering  WorkStatus = "mastering"
	WorkStatusReviewing  WorkStatus = "reviewing"
	WorkStatusReleased   WorkStatus = "released"
)

type WorkType string

const (
	WorkTypeAlbum   WorkType = "album"
	WorkTypeSingle  WorkType = "single"
	WorkTypeEP      WorkType = "ep"
)

type Brand string

const (
	BrandA Brand = "brand_a"
	BrandB Brand = "brand_b"
	BrandC Brand = "brand_c"
)

type ContributorRole string

const (
	RoleLyricist   ContributorRole = "lyricist"
	RoleComposer   ContributorRole = "composer"
	RoleArranger   ContributorRole = "arranger"
	RoleProducer   ContributorRole = "producer"
	RolePerformer  ContributorRole = "performer"
)

type Work struct {
	ID            string          `json:"id"`
	Title         string          `json:"title"`
	Type          WorkType        `json:"type"`
	Brand         Brand           `json:"brand"`
	Status        WorkStatus      `json:"status"`
	ISRC          string          `json:"isrc"`
	ISWC          string          `json:"iswc"`
	Duration      int             `json:"duration"`
	Genre         string          `json:"genre"`
	ReleaseDate   *time.Time      `json:"release_date"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	Versions      []WorkVersion   `json:"versions,omitempty"`
	Contributors  []Contributor   `json:"contributors,omitempty"`
	AuthChain     []AuthLink      `json:"auth_chain,omitempty"`
}

type WorkVersion struct {
	ID         string     `json:"id"`
	WorkID     string     `json:"work_id"`
	Version    string     `json:"version"`
	Status     WorkStatus `json:"status"`
	FileURL    string     `json:"file_url"`
	FileSize   int64      `json:"file_size"`
	AudioFingerprint string  `json:"audio_fingerprint"`
	CreatedAt  time.Time  `json:"created_at"`
	CreatedBy  string     `json:"created_by"`
	Note       string     `json:"note"`
}

type Contributor struct {
	ID       string          `json:"id"`
	WorkID   string          `json:"work_id"`
	ArtistID string          `json:"artist_id"`
	ArtistName string        `json:"artist_name"`
	Role     ContributorRole `json:"role"`
	RoyaltyRuleID string     `json:"royalty_rule_id"`
}

type AuthLink struct {
	ID           string    `json:"id"`
	WorkID       string    `json:"work_id"`
	ParentWorkID *string   `json:"parent_work_id"`
	ParentTitle  string    `json:"parent_title"`
	AuthType     AuthType  `json:"auth_type"`
	LicenseType  string    `json:"license_type"`
	AuthStatus   AuthStatus `json:"auth_status"`
	AuthDocURL   string    `json:"auth_doc_url"`
	AuthDate     *time.Time `json:"auth_date"`
	ExpireDate   *time.Time `json:"expire_date"`
	Fee          float64   `json:"fee"`
	Note         string    `json:"note"`
}

type AuthType string

const (
	AuthTypeOriginal  AuthType = "original"
	AuthTypeAdapt     AuthType = "adapt"
	AuthTypeSample    AuthType = "sample"
	AuthTypeCover     AuthType = "cover"
	AuthTypeRemix     AuthType = "remix"
)

type AuthStatus string

const (
	AuthStatusPending   AuthStatus = "pending"
	AuthStatusApproved  AuthStatus = "approved"
	AuthStatusRejected  AuthStatus = "rejected"
	AuthStatusExpired   AuthStatus = "expired"
)

type Artist struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Brand     Brand     `json:"brand"`
	Signature string    `json:"signature"`
	Contact   string    `json:"contact"`
	JoinDate  time.Time `json:"join_date"`
	CreatedAt time.Time `json:"created_at"`
}

type UserRole string

const (
	RoleArtist       UserRole = "artist"
	RoleUserProducer UserRole = "producer"
	RoleCopyright    UserRole = "copyright"
	RoleFinance      UserRole = "finance"
	RoleAdmin        UserRole = "admin"
)

type User struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	RealName  string    `json:"real_name"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Role      UserRole  `json:"role"`
	ArtistID  *string   `json:"artist_id"`
	CreatedAt time.Time `json:"created_at"`
	LastLogin *time.Time `json:"last_login"`
}

type AuditLog struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	Action    string    `json:"action"`
	Resource  string    `json:"resource"`
	ResourceID string   `json:"resource_id"`
	Detail    string    `json:"detail"`
	IP        string    `json:"ip"`
	CreatedAt time.Time `json:"created_at"`
}
