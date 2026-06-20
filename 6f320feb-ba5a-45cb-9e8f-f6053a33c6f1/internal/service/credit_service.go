package service

import (
	"equipment-trading-platform/internal/model"
	"equipment-trading-platform/internal/repository"
	"time"
)

type CreditService struct {
	userRepo *repository.UserRepository
}

func NewCreditService() *CreditService {
	return &CreditService{
		userRepo: repository.NewUserRepository(),
	}
}

func (s *CreditService) GetOrCreateRating(userID uint64) (*model.CreditRating, error) {
	return s.userRepo.GetOrCreateCreditRating(userID)
}

func (s *CreditService) AddRecord(userID uint64, relatedUserID, transactionID, disputeID *uint64, recordType string, scoreChange int, description string) error {
	record := &model.CreditRecord{
		UserID:        userID,
		RelatedUserID: relatedUserID,
		TransactionID: transactionID,
		DisputeID:     disputeID,
		Type:          recordType,
		ScoreChange:   scoreChange,
		Description:   description,
	}

	if err := s.userRepo.AddCreditRecord(record); err != nil {
		return err
	}

	rating, err := s.userRepo.GetOrCreateCreditRating(userID)
	if err != nil {
		return err
	}

	rating.Score += scoreChange
	if rating.Score < 0 {
		rating.Score = 0
	}
	if rating.Score > 100 {
		rating.Score = 100
	}

	rating.Level = calculateLevel(rating.Score)

	now := time.Now()
	rating.LastEvaluatedAt = &now

	return s.userRepo.UpdateCreditRating(rating)
}

func calculateLevel(score int) string {
	switch {
	case score >= 90:
		return "S"
	case score >= 80:
		return "A"
	case score >= 70:
		return "B"
	case score >= 60:
		return "C"
	case score >= 40:
		return "D"
	default:
		return "E"
	}
}

func (s *CreditService) OnTradeSuccess(userID uint64) error {
	rating, err := s.userRepo.GetOrCreateCreditRating(userID)
	if err != nil {
		return err
	}

	rating.TradeCount++
	rating.PositiveReviews++

	totalReviews := rating.PositiveReviews + rating.NeutralReviews + rating.NegativeReviews
	if totalReviews > 0 {
		rating.SuccessRate = float64(rating.PositiveReviews) / float64(totalReviews) * 100
	}

	now := time.Now()
	rating.LastEvaluatedAt = &now

	return s.userRepo.UpdateCreditRating(rating)
}

type ReviewRequest struct {
	UserID        uint64 `json:"user_id"`
	RelatedUserID uint64 `json:"related_user_id"`
	TransactionID uint64 `json:"transaction_id"`
	Rating        string `json:"rating"`
	Comment       string `json:"comment"`
}

func (s *CreditService) Review(req *ReviewRequest) error {
	var scoreChange int
	var ratingChange string

	switch req.Rating {
	case "positive":
		scoreChange = 2
		ratingChange = "positive"
	case "neutral":
		scoreChange = 0
		ratingChange = "neutral"
	case "negative":
		scoreChange = -5
		ratingChange = "negative"
	default:
		scoreChange = 0
		ratingChange = "neutral"
	}

	if err := s.AddRecord(req.RelatedUserID, &req.UserID, &req.TransactionID, nil,
		"review", scoreChange, "交易评价："+req.Comment); err != nil {
		return err
	}

	rating, err := s.userRepo.GetOrCreateCreditRating(req.RelatedUserID)
	if err != nil {
		return err
	}

	switch ratingChange {
	case "positive":
		rating.PositiveReviews++
	case "neutral":
		rating.NeutralReviews++
	case "negative":
		rating.NegativeReviews++
	}

	totalReviews := rating.PositiveReviews + rating.NeutralReviews + rating.NegativeReviews
	if totalReviews > 0 {
		rating.SuccessRate = float64(rating.PositiveReviews) / float64(totalReviews) * 100
	}

	now := time.Now()
	rating.LastEvaluatedAt = &now

	return s.userRepo.UpdateCreditRating(rating)
}

func (s *CreditService) ListRecords(userID uint64, page, pageSize int) ([]*model.CreditRecord, int64, error) {
	return s.userRepo.ListCreditRecords(userID, page, pageSize)
}

func (s *CreditService) IsBlacklisted(userID uint64) (bool, error) {
	rating, err := s.userRepo.GetOrCreateCreditRating(userID)
	if err != nil {
		return false, err
	}
	return rating.Score < 30, nil
}
