package repositories

import (
	"gorm.io/gorm"
	"exhibition-center/internal/models"
)

type BoothRepository struct {
	db *gorm.DB
}

func NewBoothRepository(db *gorm.DB) *BoothRepository {
	return &BoothRepository{db: db}
}

func (r *BoothRepository) List(venueID, status, zone string) ([]models.Booth, error) {
	var booths []models.Booth
	query := r.db.Model(&models.Booth{})
	if venueID != "" {
		query = query.Where("venue_id = ?", venueID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if zone != "" {
		query = query.Where("zone = ?", zone)
	}

	if err := query.Order("booth_no asc").Find(&booths).Error; err != nil {
		return nil, err
	}
	return booths, nil
}

func (r *BoothRepository) GetByID(id string) (*models.Booth, error) {
	var booth models.Booth
	if err := r.db.First(&booth, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &booth, nil
}

func (r *BoothRepository) Create(booth *models.Booth) error {
	return r.db.Create(booth).Error
}

func (r *BoothRepository) Update(id string, data map[string]interface{}) error {
	return r.db.Model(&models.Booth{}).Where("id = ?", id).Updates(data).Error
}

func (r *BoothRepository) Delete(id string) error {
	return r.db.Delete(&models.Booth{}, "id = ?", id).Error
}

func (r *BoothRepository) BatchCreate(booths []models.Booth) error {
	return r.db.Create(&booths).Error
}

func (r *BoothRepository) ListVenues() ([]models.Venue, error) {
	var venues []models.Venue
	if err := r.db.Where("status = ?", "active").Order("name asc").Find(&venues).Error; err != nil {
		return nil, err
	}
	return venues, nil
}
