package service

import (
	"venue-scheduler/internal/repository"

	"gorm.io/gorm"
)

type BudgetService struct {
	db *gorm.DB
}

func NewBudgetService(db *gorm.DB) *BudgetService {
	return &BudgetService{db: db}
}

func (s *BudgetService) ValidateBudget(budgetID uint, category string, amount float64) (bool, string, error) {
	var budget repository.Budget
	if err := s.db.First(&budget, budgetID).Error; err != nil {
		return false, "", err
	}

	if budget.Status == repository.BudgetStatusFrozen {
		return false, "预算已冻结，无法新增支出", nil
	}

	var categorySpent float64
	if err := s.db.Model(&repository.Expense{}).
		Where("budget_id = ? AND category = ?", budgetID, category).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&categorySpent).Error; err != nil {
		return false, "", err
	}

	var categoryBudget float64
	switch repository.ExpenseCategory(category) {
	case repository.ExpenseCategoryStage:
		categoryBudget = budget.StageBudget
	case repository.ExpenseCategoryStaff:
		categoryBudget = budget.StaffBudget
	case repository.ExpenseCategoryMarketing:
		categoryBudget = budget.MarketingBudget
	case repository.ExpenseCategoryVenue:
		categoryBudget = budget.VenueBudget
	}

	if categoryBudget > 0 && categorySpent+amount > categoryBudget {
		return false, "该分类预算已超支", nil
	}

	if budget.TotalBudget > 0 && budget.TotalSpent+amount > budget.TotalBudget {
		return false, "总预算已超支", nil
	}

	return true, "", nil
}

func (s *BudgetService) CheckBudgetWarning(budget *repository.Budget) []string {
	var warnings []string

	categories := []struct {
		name   string
		budget float64
	}{
		{"stage", budget.StageBudget},
		{"staff", budget.StaffBudget},
		{"marketing", budget.MarketingBudget},
		{"venue", budget.VenueBudget},
	}

	for _, cat := range categories {
		var spent float64
		s.db.Model(&repository.Expense{}).
			Where("budget_id = ? AND category = ?", budget.ID, cat.name).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&spent)

		if cat.budget > 0 && spent/cat.budget >= 0.9 {
			warnings = append(warnings, cat.name)
		}
	}

	if budget.TotalBudget > 0 && budget.TotalSpent/budget.TotalBudget >= 0.9 {
		warnings = append(warnings, "total")
	}

	return warnings
}

func (s *BudgetService) AddExpense(expense *repository.Expense) error {
	valid, msg, err := s.ValidateBudget(expense.BudgetID, string(expense.Category), expense.Amount)
	if err != nil {
		return err
	}
	if !valid {
		return &BudgetError{Message: msg}
	}

	tx := s.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Create(expense).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&repository.Budget{}).
		Where("id = ?", expense.BudgetID).
		UpdateColumn("total_spent", gorm.Expr("total_spent + ?", expense.Amount)).Error; err != nil {
		tx.Rollback()
		return err
	}

	var budget repository.Budget
	if err := tx.First(&budget, expense.BudgetID).Error; err != nil {
		tx.Rollback()
		return err
	}

	if budget.TotalBudget > 0 && budget.TotalSpent >= budget.TotalBudget {
		if err := tx.Model(&budget).Update("status", repository.BudgetStatusFrozen).Error; err != nil {
			tx.Rollback()
			return err
		}
	} else if len(s.CheckBudgetWarning(&budget)) > 0 && budget.Status == repository.BudgetStatusNormal {
		if err := tx.Model(&budget).Update("status", repository.BudgetStatusWarning).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
}

type BudgetError struct {
	Message string
}

func (e *BudgetError) Error() string {
	return e.Message
}

func (s *BudgetService) GetBudgetSummary(budgetID uint) (*repository.Budget, map[string]float64, error) {
	var budget repository.Budget
	if err := s.db.First(&budget, budgetID).Error; err != nil {
		return nil, nil, err
	}

	categorySpent := make(map[string]float64)
	categories := []string{"stage", "staff", "marketing", "venue"}

	for _, cat := range categories {
		var spent float64
		s.db.Model(&repository.Expense{}).
			Where("budget_id = ? AND category = ?", budgetID, cat).
			Select("COALESCE(SUM(amount), 0)").
			Scan(&spent)
		categorySpent[cat] = spent
	}

	return &budget, categorySpent, nil
}
