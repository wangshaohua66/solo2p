package errors

import "fmt"

type ErrorCode string

const (
	ErrImportFileNotFound     ErrorCode = "IMP001"
	ErrImportFormatInvalid    ErrorCode = "IMP002"
	ErrImportColumnMissing    ErrorCode = "IMP003"
	ErrImportDataInvalid      ErrorCode = "IMP004"
	ErrImportPermissionDenied ErrorCode = "IMP005"
	ErrImportEmptyData        ErrorCode = "IMP006"

	ErrClassifyInvalidIRI       ErrorCode = "CLA001"
	ErrClassifyInvalidRut       ErrorCode = "CLA002"
	ErrClassifyInvalidCrack     ErrorCode = "CLA003"
	ErrClassifyMissingData      ErrorCode = "CLA004"
	ErrClassifyStandardNotFound ErrorCode = "CLA005"

	ErrQueryInvalidRouteID     ErrorCode = "QUE001"
	ErrQueryInvalidStation     ErrorCode = "QUE002"
	ErrQueryInvalidDateRange   ErrorCode = "QUE003"
	ErrQueryInvalidGrade       ErrorCode = "QUE004"
	ErrQueryNoResult           ErrorCode = "QUE005"
	ErrQueryDatabaseConnection ErrorCode = "QUE006"

	ErrBudgetNegativeAmount   ErrorCode = "BUD001"
	ErrBudgetInsufficientFund ErrorCode = "BUD002"
	ErrBudgetNoValidSection   ErrorCode = "BUD003"

	ErrPriorityInvalidWeight  ErrorCode = "PRI001"
	ErrPriorityNoData         ErrorCode = "PRI002"

	ErrStorageOpenFailed      ErrorCode = "STO001"
	ErrStorageMigrationFailed ErrorCode = "STO002"
	ErrStorageQueryFailed     ErrorCode = "STO003"
	ErrStorageInsertFailed    ErrorCode = "STO004"
	ErrStorageUpdateFailed    ErrorCode = "STO005"
	ErrStorageDeleteFailed    ErrorCode = "STO006"
	ErrStorageTxBeginFailed   ErrorCode = "STO007"
	ErrStorageTxCommitFailed  ErrorCode = "STO008"
	ErrStorageTxRollbackFail  ErrorCode = "STO009"

	ErrExportWriteFailed    ErrorCode = "EXP001"
	ErrExportTemplateError  ErrorCode = "EXP002"
	ErrExportEmptyData      ErrorCode = "EXP003"

	ErrValidatorInvalidPath   ErrorCode = "VAL001"
	ErrValidatorInvalidStation ErrorCode = "VAL002"
	ErrValidatorInvalidDate   ErrorCode = "VAL003"
	ErrValidatorNegativeBudget ErrorCode = "VAL004"
	ErrValidatorInvalidBatch  ErrorCode = "VAL005"
)

type PavementError struct {
	Code       ErrorCode
	Message    string
	Suggestion string
	Err        error
}

func (e *PavementError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v. 建议: %s", e.Code, e.Message, e.Err, e.Suggestion)
	}
	return fmt.Sprintf("[%s] %s. 建议: %s", e.Code, e.Message, e.Suggestion)
}

func (e *PavementError) Unwrap() error {
	return e.Err
}

func NewImportError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewClassifyError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewQueryError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewBudgetError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewPriorityError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewStorageError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewExportError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}

func NewValidatorError(code ErrorCode, msg string, suggestion string, err error) *PavementError {
	return &PavementError{
		Code:       code,
		Message:    msg,
		Suggestion: suggestion,
		Err:        err,
	}
}
