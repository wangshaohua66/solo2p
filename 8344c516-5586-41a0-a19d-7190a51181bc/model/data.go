package model

import (
	"os"
	"path/filepath"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

type User struct {
	ID           uint      `gorm:"primaryKey;column:id"`
	Username     string    `gorm:"size:50;uniqueIndex;column:username;not null"`
	Password     string    `gorm:"size:255;column:password;not null"`
	RealName     string    `gorm:"size:50;column:real_name;not null"`
	IDCard       string    `gorm:"size:18;uniqueIndex;column:id_card"`
	Phone        string    `gorm:"size:20;column:phone"`
	Email        string    `gorm:"size:100;column:email"`
	Role         string    `gorm:"size:20;column:role;not null;default:'user'"`
	Status       int       `gorm:"column:status;default:1"`
	Avatar       string    `gorm:"size:255;column:avatar"`
	InstitutionID *uint     `gorm:"column:institution_id;index"`
	Institution  *Institution `gorm:"foreignKey:InstitutionID"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

type Trade struct {
	ID        uint      `gorm:"primaryKey;column:id"`
	Name      string    `gorm:"size:100;column:name;not null"`
	Code      string    `gorm:"size:50;uniqueIndex;column:code;not null"`
	Level     string    `gorm:"size:20;column:level;not null;default:'初级'"`
	LevelCode string    `gorm:"size:20;column:level_code;not null;default:'5'"`
	ParentID  *uint     `gorm:"column:parent_id;index"`
	Parent    *Trade    `gorm:"foreignKey:ParentID"`
	Sort      int       `gorm:"column:sort;default:0"`
	Status    int       `gorm:"column:status;default:1"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

type Institution struct {
	ID          uint      `gorm:"primaryKey;column:id"`
	Name        string    `gorm:"size:200;column:name;not null"`
	Code        string    `gorm:"size:50;uniqueIndex;column:code;not null"`
	Contact     string    `gorm:"size:50;column:contact"`
	Phone       string    `gorm:"size:20;column:phone"`
	Address     string    `gorm:"size:500;column:address"`
	LicenseNo   string    `gorm:"size:100;column:license_no"`
	Status      int       `gorm:"column:status;default:1"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

type Exam struct {
	ID             uint      `gorm:"primaryKey;column:id"`
	Name           string    `gorm:"size:200;column:name;not null"`
	TradeID        uint      `gorm:"column:trade_id;index;not null"`
	Trade          Trade     `gorm:"foreignKey:TradeID"`
	Level          string    `gorm:"size:20;column:level;not null"`
	LevelCode      string    `gorm:"size:20;column:level_code;not null"`
	InstitutionID  uint      `gorm:"column:institution_id;index;not null"`
	Institution    Institution `gorm:"foreignKey:InstitutionID"`
	ExamType       string    `gorm:"size:20;column:exam_type;not null;default:'theory'"`
	ExamDate       time.Time `gorm:"column:exam_date;index;not null"`
	StartTime      string    `gorm:"size:20;column:start_time;not null"`
	EndTime        string    `gorm:"size:20;column:end_time;not null"`
	Duration       int       `gorm:"column:duration;not null;default:120"`
	TotalSeats     int       `gorm:"column:total_seats;not null;default:0"`
	AppliedCount   int       `gorm:"column:applied_count;default:0"`
	PassingScore   int       `gorm:"column:passing_score;default:60"`
	TotalScore     int       `gorm:"column:total_score;default:100"`
	Status         int       `gorm:"column:status;default:0"`
	Remark         string    `gorm:"size:500;column:remark"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

type ExamApply struct {
	ID            uint      `gorm:"primaryKey;column:id"`
	ExamID        uint      `gorm:"column:exam_id;index;not null"`
	Exam          Exam      `gorm:"foreignKey:ExamID"`
	UserID        uint      `gorm:"column:user_id;index;not null"`
	User          User      `gorm:"foreignKey:UserID"`
	ApplyNo       string    `gorm:"size:50;uniqueIndex;column:apply_no;not null"`
	TradeID       uint      `gorm:"column:trade_id;index;not null"`
	Trade         Trade     `gorm:"foreignKey:TradeID"`
	Level         string    `gorm:"size:20;column:level;not null"`
	LevelCode     string    `gorm:"size:20;column:level_code;not null"`
	WorkstationID *uint     `gorm:"column:workstation_id;index"`
	Workstation   *Workstation `gorm:"foreignKey:WorkstationID"`
	SeatNo        string    `gorm:"size:20;column:seat_no"`
	ApplyStatus   int       `gorm:"column:apply_status;default:0"`
	PayStatus     int       `gorm:"column:pay_status;default:0"`
	PayAmount     float64   `gorm:"column:pay_amount;default:0"`
	PayTime       *time.Time `gorm:"column:pay_time"`
	AdmissionNo   string    `gorm:"size:50;column:admission_no"`
	Score         *float64  `gorm:"column:score"`
	PassStatus    *int      `gorm:"column:pass_status"`
	ApplyTime     time.Time `gorm:"column:apply_time"`
	Remark        string    `gorm:"size:500;column:remark"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

type Workstation struct {
	ID         uint      `gorm:"primaryKey;column:id"`
	Name       string    `gorm:"size:100;column:name;not null"`
	Code       string    `gorm:"size:50;uniqueIndex;column:code;not null"`
	Location   string    `gorm:"size:200;column:location"`
	SeatCount  int       `gorm:"column:seat_count;default:30"`
	ExamType   string    `gorm:"size:20;column:exam_type;default:'all'"`
	Equipment  string    `gorm:"size:500;column:equipment"`
	Status     int       `gorm:"column:status;default:1"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

type Schedule struct {
	ID             uint         `gorm:"primaryKey;column:id"`
	ExamID         uint         `gorm:"column:exam_id;index;not null"`
	Exam           Exam         `gorm:"foreignKey:ExamID"`
	WorkstationID  uint         `gorm:"column:workstation_id;index;not null"`
	Workstation    Workstation  `gorm:"foreignKey:WorkstationID"`
	ScheduleDate   time.Time    `gorm:"column:schedule_date;index;not null"`
	StartTime      string       `gorm:"size:20;column:start_time;not null"`
	EndTime        string       `gorm:"size:20;column:end_time;not null"`
	Status         int          `gorm:"column:status;default:1"`
	CreatedAt      time.Time    `gorm:"column:created_at"`
	UpdatedAt      time.Time    `gorm:"column:updated_at"`
}

type ExaminerAssign struct {
	ID           uint      `gorm:"primaryKey;column:id"`
	ExamID       uint      `gorm:"column:exam_id;index;not null"`
	Exam         Exam      `gorm:"foreignKey:ExamID"`
	ExaminerID   uint      `gorm:"column:examiner_id;index;not null"`
	Examiner     User      `gorm:"foreignKey:ExaminerID"`
	ScheduleID   uint      `gorm:"column:schedule_id;index;not null"`
	Schedule     Schedule  `gorm:"foreignKey:ScheduleID"`
	AssignRole   string    `gorm:"size:20;column:assign_role;default:'examiner'"`
	Status       int       `gorm:"column:status;default:1"`
	Remark       string    `gorm:"size:500;column:remark"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

type ExaminerQualification struct {
	ID            uint      `gorm:"primaryKey;column:id"`
	ExaminerID    uint      `gorm:"column:examiner_id;index;not null"`
	Examiner      User      `gorm:"foreignKey:ExaminerID"`
	TradeID       uint      `gorm:"column:trade_id;index;not null"`
	Trade         Trade     `gorm:"foreignKey:TradeID"`
	Level         string    `gorm:"size:20;column:level;not null"`
	LevelCode     string    `gorm:"size:20;column:level_code;not null"`
	CertificateNo string    `gorm:"size:100;column:certificate_no;not null"`
	IssuedDate    time.Time `gorm:"column:issued_date;not null"`
	ExpiryDate    time.Time `gorm:"column:expiry_date;index;not null"`
	Status        int       `gorm:"column:status;default:1"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

type Question struct {
	ID          uint      `gorm:"primaryKey;column:id"`
	TradeID     uint      `gorm:"column:trade_id;index;not null"`
	Trade       Trade     `gorm:"foreignKey:TradeID"`
	Level       string    `gorm:"size:20;column:level;not null"`
	LevelCode   string    `gorm:"size:20;column:level_code;not null"`
	Type        string    `gorm:"size:20;column:type;not null"`
	Difficulty  string    `gorm:"size:20;column:difficulty;default:'medium'"`
	Knowledge   string    `gorm:"size:200;column:knowledge"`
	Content     string    `gorm:"type:text;column:content;not null"`
	OptionA     string    `gorm:"size:500;column:option_a"`
	OptionB     string    `gorm:"size:500;column:option_b"`
	OptionC     string    `gorm:"size:500;column:option_c"`
	OptionD     string    `gorm:"size:500;column:option_d"`
	Answer      string    `gorm:"size:200;column:answer;not null"`
	Analysis    string    `gorm:"type:text;column:analysis"`
	Score       int       `gorm:"column:score;default:1"`
	Status      int       `gorm:"column:status;default:1"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

type Paper struct {
	ID          uint      `gorm:"primaryKey;column:id"`
	Name        string    `gorm:"size:200;column:name;not null"`
	TradeID     uint      `gorm:"column:trade_id;index;not null"`
	Trade       Trade     `gorm:"foreignKey:TradeID"`
	Level       string    `gorm:"size:20;column:level;not null"`
	LevelCode   string    `gorm:"size:20;column:level_code;not null"`
	ExamType    string    `gorm:"size:20;column:exam_type;not null"`
	TotalScore  int       `gorm:"column:total_score;default:100"`
	PassingScore int      `gorm:"column:passing_score;default:60"`
	Duration    int       `gorm:"column:duration;default:120"`
	QuestionCount int     `gorm:"column:question_count;default:0"`
	Version     string    `gorm:"size:50;column:version"`
	Status      int       `gorm:"column:status;default:1"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

type PaperQuestion struct {
	ID         uint      `gorm:"primaryKey;column:id"`
	PaperID    uint      `gorm:"column:paper_id;index;not null"`
	Paper      Paper     `gorm:"foreignKey:PaperID"`
	QuestionID uint      `gorm:"column:question_id;index;not null"`
	Question   Question  `gorm:"foreignKey:QuestionID"`
	Sort       int       `gorm:"column:sort;default:0"`
	Score      int       `gorm:"column:score;default:1"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

type Score struct {
	ID            uint      `gorm:"primaryKey;column:id"`
	ExamApplyID   uint      `gorm:"column:exam_apply_id;uniqueIndex;not null"`
	ExamApply     ExamApply `gorm:"foreignKey:ExamApplyID"`
	ExamID        uint      `gorm:"column:exam_id;index;not null"`
	Exam          Exam      `gorm:"foreignKey:ExamID"`
	UserID        uint      `gorm:"column:user_id;index;not null"`
	User          User      `gorm:"foreignKey:UserID"`
	TradeID       uint      `gorm:"column:trade_id;index;not null"`
	Trade         Trade     `gorm:"foreignKey:TradeID"`
	TheoryScore   *float64  `gorm:"column:theory_score"`
	PracticeScore *float64  `gorm:"column:practice_score"`
	TotalScore    *float64  `gorm:"column:total_score"`
	PassStatus    *int      `gorm:"column:pass_status;index"`
	ScoreStatus   int       `gorm:"column:score_status;default:0"`
	ReviewerID    *uint     `gorm:"column:reviewer_id;index"`
	Reviewer      *User     `gorm:"foreignKey:ReviewerID"`
	ReviewTime    *time.Time `gorm:"column:review_time"`
	Remark        string    `gorm:"size:500;column:remark"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

type Certificate struct {
	ID            uint      `gorm:"primaryKey;column:id"`
	CertificateNo string    `gorm:"size:100;uniqueIndex;column:certificate_no;not null"`
	UserID        uint      `gorm:"column:user_id;index;not null"`
	User          User      `gorm:"foreignKey:UserID"`
	TradeID       uint      `gorm:"column:trade_id;index;not null"`
	Trade         Trade     `gorm:"foreignKey:TradeID"`
	Level         string    `gorm:"size:20;column:level;not null"`
	LevelCode     string    `gorm:"size:20;column:level_code;not null"`
	ScoreID       uint      `gorm:"column:score_id;uniqueIndex;not null"`
	Score         Score     `gorm:"foreignKey:ScoreID"`
	IssuedDate    time.Time `gorm:"column:issued_date;not null"`
	ExpiryDate    *time.Time `gorm:"column:expiry_date;index"`
	QrCode        string    `gorm:"size:500;column:qr_code"`
	VerifyUrl     string    `gorm:"size:500;column:verify_url"`
	Status        int       `gorm:"column:status;default:1"`
	PrintCount    int       `gorm:"column:print_count;default:0"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

type WorkstationOccupy struct {
	ID             uint        `gorm:"primaryKey;column:id"`
	WorkstationID  uint        `gorm:"column:workstation_id;index;not null"`
	Workstation    Workstation `gorm:"foreignKey:WorkstationID"`
	ScheduleID     uint        `gorm:"column:schedule_id;index;not null"`
	Schedule       Schedule    `gorm:"foreignKey:ScheduleID"`
	ExamID         uint        `gorm:"column:exam_id;index;not null"`
	Exam           Exam        `gorm:"foreignKey:ExamID"`
	OccupyDate     time.Time   `gorm:"column:occupy_date;index;not null"`
	StartTime      string      `gorm:"size:20;column:start_time;not null"`
	EndTime        string      `gorm:"size:20;column:end_time;not null"`
	Status         int         `gorm:"column:status;default:1"`
	CreatedAt      time.Time   `gorm:"column:created_at"`
	UpdatedAt      time.Time   `gorm:"column:updated_at"`
}

type OperationLog struct {
	ID         uint      `gorm:"primaryKey;column:id"`
	UserID     uint      `gorm:"column:user_id;index;not null"`
	User       User      `gorm:"foreignKey:UserID"`
	Username   string    `gorm:"size:50;column:username;not null"`
	Module     string    `gorm:"size:50;column:module;index;not null"`
	Operation  string    `gorm:"size:200;column:operation;not null"`
	Method     string    `gorm:"size:20;column:method"`
	IP         string    `gorm:"size:50;column:ip"`
	UserAgent  string    `gorm:"size:500;column:user_agent"`
	Params     string    `gorm:"type:text;column:params"`
	Result     string    `gorm:"type:text;column:result"`
	Status     int       `gorm:"column:status;default:1"`
	CreatedAt  time.Time `gorm:"column:created_at;index"`
}

func (User) TableName() string {
	return "sys_user"
}

func (Trade) TableName() string {
	return "sys_trade"
}

func (Institution) TableName() string {
	return "sys_institution"
}

func (Exam) TableName() string {
	return "biz_exam"
}

func (ExamApply) TableName() string {
	return "biz_exam_apply"
}

func (Workstation) TableName() string {
	return "biz_workstation"
}

func (Schedule) TableName() string {
	return "biz_schedule"
}

func (ExaminerAssign) TableName() string {
	return "biz_examiner_assign"
}

func (ExaminerQualification) TableName() string {
	return "biz_examiner_qualification"
}

func (Question) TableName() string {
	return "biz_question"
}

func (Paper) TableName() string {
	return "biz_paper"
}

func (PaperQuestion) TableName() string {
	return "biz_paper_question"
}

func (Score) TableName() string {
	return "biz_score"
}

func (Certificate) TableName() string {
	return "biz_certificate"
}

func (WorkstationOccupy) TableName() string {
	return "biz_workstation_occupy"
}

func (OperationLog) TableName() string {
	return "sys_operation_log"
}

func InitDB() error {
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(dataDir, "exam_system.db")
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	_, err = sqlDB.Exec("PRAGMA journal_mode = WAL;")
	if err != nil {
		return err
	}
	_, err = sqlDB.Exec("PRAGMA synchronous = NORMAL;")
	if err != nil {
		return err
	}
	_, err = sqlDB.Exec("PRAGMA cache_size = -20000;")
	if err != nil {
		return err
	}
	_, err = sqlDB.Exec("PRAGMA temp_store = MEMORY;")
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&User{},
		&Trade{},
		&Institution{},
		&Exam{},
		&ExamApply{},
		&Workstation{},
		&Schedule{},
		&ExaminerAssign{},
		&ExaminerQualification{},
		&Question{},
		&Paper{},
		&PaperQuestion{},
		&Score{},
		&Certificate{},
		&WorkstationOccupy{},
		&OperationLog{},
	)
	if err != nil {
		return err
	}

	err = initSeedData()
	if err != nil {
		return err
	}

	return nil
}

func initSeedData() error {
	var adminCount int64
	DB.Model(&User{}).Where("username = ?", "admin").Count(&adminCount)
	if adminCount == 0 {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		admin := User{
			Username: "admin",
			Password: string(hashedPassword),
			RealName: "系统管理员",
			Role:     "admin",
			Status:   1,
		}
		if err := DB.Create(&admin).Error; err != nil {
			return err
		}
	}

	var tradeCount int64
	DB.Model(&Trade{}).Count(&tradeCount)
	if tradeCount == 0 {
		categories := []Trade{
			{Name: "生产制造类", Code: "CAT001", Sort: 1, Status: 1},
			{Name: "交通运输类", Code: "CAT002", Sort: 2, Status: 1},
			{Name: "建筑工程类", Code: "CAT003", Sort: 3, Status: 1},
			{Name: "信息技术类", Code: "CAT004", Sort: 4, Status: 1},
			{Name: "生活服务类", Code: "CAT005", Sort: 5, Status: 1},
			{Name: "农业生产类", Code: "CAT006", Sort: 6, Status: 1},
		}
		for i := range categories {
			if err := DB.Create(&categories[i]).Error; err != nil {
				return err
			}
		}

		exampleTrades := []Trade{
			{Name: "电工", Code: "TRADE001", Level: "初级", LevelCode: "5", ParentID: &categories[0].ID, Sort: 1, Status: 1},
			{Name: "电工", Code: "TRADE002", Level: "中级", LevelCode: "4", ParentID: &categories[0].ID, Sort: 2, Status: 1},
			{Name: "电工", Code: "TRADE003", Level: "高级", LevelCode: "3", ParentID: &categories[0].ID, Sort: 3, Status: 1},
			{Name: "焊工", Code: "TRADE004", Level: "初级", LevelCode: "5", ParentID: &categories[0].ID, Sort: 4, Status: 1},
			{Name: "焊工", Code: "TRADE005", Level: "中级", LevelCode: "4", ParentID: &categories[0].ID, Sort: 5, Status: 1},
			{Name: "焊工", Code: "TRADE006", Level: "高级", LevelCode: "3", ParentID: &categories[0].ID, Sort: 6, Status: 1},
			{Name: "计算机维修工", Code: "TRADE007", Level: "初级", LevelCode: "5", ParentID: &categories[3].ID, Sort: 7, Status: 1},
			{Name: "计算机维修工", Code: "TRADE008", Level: "中级", LevelCode: "4", ParentID: &categories[3].ID, Sort: 8, Status: 1},
			{Name: "计算机维修工", Code: "TRADE009", Level: "高级", LevelCode: "3", ParentID: &categories[3].ID, Sort: 9, Status: 1},
			{Name: "中式烹调师", Code: "TRADE010", Level: "初级", LevelCode: "5", ParentID: &categories[4].ID, Sort: 10, Status: 1},
			{Name: "中式烹调师", Code: "TRADE011", Level: "中级", LevelCode: "4", ParentID: &categories[4].ID, Sort: 11, Status: 1},
			{Name: "中式烹调师", Code: "TRADE012", Level: "高级", LevelCode: "3", ParentID: &categories[4].ID, Sort: 12, Status: 1},
		}
		for i := range exampleTrades {
			if err := DB.Create(&exampleTrades[i]).Error; err != nil {
				return err
			}
		}
	}

	var workstationCount int64
	DB.Model(&Workstation{}).Count(&workstationCount)
	if workstationCount == 0 {
		workstations := []Workstation{
			{Name: "第一考场", Code: "WS001", Location: "教学楼101室", SeatCount: 30, ExamType: "theory", Equipment: "电脑30台、投影仪1台", Status: 1},
			{Name: "第二考场", Code: "WS002", Location: "教学楼102室", SeatCount: 30, ExamType: "theory", Equipment: "电脑30台、投影仪1台", Status: 1},
			{Name: "第三考场", Code: "WS003", Location: "教学楼103室", SeatCount: 30, ExamType: "theory", Equipment: "电脑30台、投影仪1台", Status: 1},
			{Name: "第一实操室", Code: "WS004", Location: "实训楼201室", SeatCount: 20, ExamType: "practice", Equipment: "实操设备20套", Status: 1},
			{Name: "第二实操室", Code: "WS005", Location: "实训楼202室", SeatCount: 20, ExamType: "practice", Equipment: "实操设备20套", Status: 1},
			{Name: "第三实操室", Code: "WS006", Location: "实训楼203室", SeatCount: 20, ExamType: "practice", Equipment: "实操设备20套", Status: 1},
		}
		for i := range workstations {
			if err := DB.Create(&workstations[i]).Error; err != nil {
				return err
			}
		}
	}

	var institutionCount int64
	DB.Model(&Institution{}).Count(&institutionCount)
	if institutionCount == 0 {
		institutions := []Institution{
			{Name: "市职业技能鉴定中心", Code: "INST001", Contact: "张主任", Phone: "010-12345678", Address: "北京市朝阳区职业教育园区A座", LicenseNo: "JD20240001", Status: 1},
			{Name: "区第一职业学校", Code: "INST002", Contact: "李校长", Phone: "010-87654321", Address: "北京市海淀区学院路100号", LicenseNo: "JD20240002", Status: 1},
			{Name: "市民办职业培训学校", Code: "INST003", Contact: "王校长", Phone: "010-11112222", Address: "北京市丰台区南三环西路50号", LicenseNo: "JD20240003", Status: 1},
		}
		for i := range institutions {
			if err := DB.Create(&institutions[i]).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
