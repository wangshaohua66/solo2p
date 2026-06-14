package response

import "github.com/gin-gonic/gin"

func Response(code int, message string, data interface{}) gin.H {
	return gin.H{
		"code":    code,
		"message": message,
		"data":    data,
	}
}

func Success(data interface{}) gin.H {
	return Response(0, "success", data)
}

func Fail(code int, message string) gin.H {
	return Response(code, message, nil)
}

func FailWithData(code int, message string, data interface{}) gin.H {
	return Response(code, message, data)
}
