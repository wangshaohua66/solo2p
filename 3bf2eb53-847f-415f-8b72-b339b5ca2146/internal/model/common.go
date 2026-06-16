package model

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PageResult struct {
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	List     interface{} `json:"list"`
}

type IDResponse struct {
	ID string `json:"id"`
}

type BulkRequest struct {
	IDs []string `json:"ids" validate:"required,min=1"`
}

func Success(data interface{}) *Response {
	return &Response{
		Code:    0,
		Message: "success",
		Data:    data,
	}
}

func Error(code int, message string) *Response {
	return &Response{
		Code:    code,
		Message: message,
	}
}

type Config struct {
	Server   ServerConfig
	MongoDB  MongoDBConfig
	JWT      JWTConfig
	Weather  WeatherConfig
	RateLimit RateLimitConfig
}

type ServerConfig struct {
	Port         string
	Mode         string
	ReadTimeout  int
	WriteTimeout int
}

type MongoDBConfig struct {
	URI            string
	Database       string
	MaxPoolSize    uint64
	MinPoolSize    uint64
	ConnectTimeout int
}

type JWTConfig struct {
	Secret             string
	AccessTokenExpiry  int
	RefreshTokenExpiry int
	Issuer             string
}

type WeatherConfig struct {
	APIKey   string
	Endpoint string
	Timeout  int
}

type RateLimitConfig struct {
	RequestsPerMinute int
	BurstSize         int
}
