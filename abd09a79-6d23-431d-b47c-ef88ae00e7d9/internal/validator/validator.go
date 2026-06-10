package validator

import (
	"fmt"
	"strings"

	"github.com/asaskevich/govalidator"
	"bankrupt-monitor/internal/model"
)

func init() {
	govalidator.TagMap["chinese_name"] = govalidator.Validator(func(str string) bool {
		return len([]rune(str)) >= 2
	})
	govalidator.TagMap["case_number"] = govalidator.Validator(func(str string) bool {
		return len(str) >= 4
	})
	govalidator.TagMap["court_name"] = govalidator.Validator(func(str string) bool {
		return strings.Contains(str, "法院") || strings.Contains(str, "法庭")
	})
}

type CaseInput struct {
	CaseNumber string `valid:"required,case_number"`
	Debtor     string `valid:"required,chinese_name"`
	Court      string `valid:"required,court_name"`
}

type AnnouncementInput struct {
	Title     string `valid:"required"`
	SourceURL string `valid:"required,url"`
	Court     string `valid:"required,court_name"`
}

func ValidateCase(c *model.Case) error {
	if c == nil {
		return fmt.Errorf("case is nil")
	}
	input := &CaseInput{
		CaseNumber: c.CaseNumber,
		Debtor:     c.Debtor,
		Court:      c.Court,
	}
	_, err := govalidator.ValidateStruct(input)
	if err != nil {
		return fmt.Errorf("case validation: %w", err)
	}
	return nil
}

func ValidateAnnouncement(a *model.Announcement) error {
	if a == nil {
		return fmt.Errorf("announcement is nil")
	}
	input := &AnnouncementInput{
		Title:     a.Title,
		SourceURL: a.SourceURL,
		Court:     a.Court,
	}
	_, err := govalidator.ValidateStruct(input)
	if err != nil {
		return fmt.Errorf("announcement validation: %w", err)
	}
	return nil
}

func ValidateSubscription(s *model.Subscription) error {
	if s == nil {
		return fmt.Errorf("subscription is nil")
	}
	if strings.TrimSpace(s.Keyword) == "" {
		return fmt.Errorf("subscription keyword is required")
	}
	switch s.MatchType {
	case "exact", "prefix", "contains", "":
	default:
		return fmt.Errorf("invalid match_type: %s", s.MatchType)
	}
	return nil
}
