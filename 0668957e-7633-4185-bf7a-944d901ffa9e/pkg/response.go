package pkg

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type ErrCode int

const (
	CodeSuccess           ErrCode = 0
	CodeInvalidParams     ErrCode = 10001
	CodeUnauthorized      ErrCode = 10002
	CodeForbidden         ErrCode = 10003
	CodeNotFound          ErrCode = 10004
	CodeInternalError     ErrCode = 10005
	CodeTooManyRequests   ErrCode = 10006

	CodeAuctionNotFound       ErrCode = 20001
	CodeAuctionNotActive      ErrCode = 20002
	CodeAuctionAlreadyEnded   ErrCode = 20003
	CodeAuctionCreateFailed   ErrCode = 20004

	CodeBidTooLow             ErrCode = 30001
	CodeBidNotHighest         ErrCode = 30002
	CodeBidWithdrawTooLate    ErrCode = 30003
	CodeBidNotFound           ErrCode = 30004
	CodeBidNotOwner           ErrCode = 30005
	CodeBidPlaceFailed        ErrCode = 30006
	CodeBidWithdrawFailed     ErrCode = 30007
)

var errMsg = map[ErrCode]string{
	CodeSuccess:           "success",
	CodeInvalidParams:     "invalid parameters",
	CodeUnauthorized:      "unauthorized",
	CodeForbidden:         "forbidden",
	CodeNotFound:          "resource not found",
	CodeInternalError:     "internal server error",
	CodeTooManyRequests:   "too many requests",

	CodeAuctionNotFound:     "auction not found",
	CodeAuctionNotActive:    "auction is not active",
	CodeAuctionAlreadyEnded: "auction already ended",
	CodeAuctionCreateFailed: "failed to create auction",

	CodeBidTooLow:           "bid price too low",
	CodeBidNotHighest:       "not the highest bid",
	CodeBidWithdrawTooLate:  "cannot withdraw when remaining time less than 20%",
	CodeBidNotFound:         "bid not found",
	CodeBidNotOwner:         "not the owner of the bid",
	CodeBidPlaceFailed:      "failed to place bid",
	CodeBidWithdrawFailed:   "failed to withdraw bid",
}

type Response struct {
	Code    ErrCode     `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func Success(c echo.Context, data interface{}) error {
	return c.JSON(http.StatusOK, Response{
		Code:    CodeSuccess,
		Message: errMsg[CodeSuccess],
		Data:    data,
	})
}

func Fail(c echo.Context, httpStatus int, code ErrCode) error {
	return c.JSON(httpStatus, Response{
		Code:    code,
		Message: errMsg[code],
	})
}

func FailWithMsg(c echo.Context, httpStatus int, code ErrCode, msg string) error {
	return c.JSON(httpStatus, Response{
		Code:    code,
		Message: msg,
	})
}

func FailWithData(c echo.Context, httpStatus int, code ErrCode, data interface{}) error {
	return c.JSON(httpStatus, Response{
		Code:    code,
		Message: errMsg[code],
		Data:    data,
	})
}

func GetErrMsg(code ErrCode) string {
	if msg, ok := errMsg[code]; ok {
		return msg
	}
	return "unknown error"
}
