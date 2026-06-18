package response

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PageResult struct {
	Total int64       `json:"total"`
	List  interface{} `json:"list"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Rule    string `json:"rule"`
	Message string `json:"message"`
}

type ValidationErrorResponse struct {
	Code    int               `json:"code"`
	Message string            `json:"message"`
	Errors  []ValidationError `json:"errors"`
}

func Success(data interface{}) Response {
	return Response{
		Code:    0,
		Message: "success",
		Data:    data,
	}
}

func SuccessPage(total int64, list interface{}) Response {
	return Response{
		Code:    0,
		Message: "success",
		Data: PageResult{
			Total: total,
			List:  list,
		},
	}
}

func Error(code int, message string) Response {
	return Response{
		Code:    code,
		Message: message,
	}
}

func ValidationErrors(errors []ValidationError) ValidationErrorResponse {
	return ValidationErrorResponse{
		Code:    400,
		Message: "参数校验失败",
		Errors:  errors,
	}
}
