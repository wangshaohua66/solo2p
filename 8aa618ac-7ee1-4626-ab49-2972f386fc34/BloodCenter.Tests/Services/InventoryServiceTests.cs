using BloodCenter.Core.Entities;
using BloodCenter.Core.Entities.Enums;
using BloodCenter.Core.Entities.ValueObjects;
using BloodCenter.Core.Interfaces;
using BloodCenter.Core.Interfaces.Data;
using BloodCenter.Core.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MockQueryable.Moq;

namespace BloodCenter.Tests.Services;

public class InventoryServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<ILogger<InventoryService>> _loggerMock;
    private readonly Mock<INotificationService> _notificationServiceMock;
    private readonly InventoryService _inventoryService;

    public InventoryServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _loggerMock = new Mock<ILogger<InventoryService>>();
        _notificationServiceMock = new Mock<INotificationService>();
        _inventoryService = new InventoryService(_unitOfWorkMock.Object, _loggerMock.Object, _notificationServiceMock.Object);
    }

    [Fact]
    public async Task GetBloodTypeBalanceAnalysisAsync_ReturnsCorrectStockLevels()
    {
        var allProducts = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "P001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), ProductionDate = DateTime.UtcNow.AddDays(-10) },
            new() { Id = Guid.NewGuid(), ProductCode = "P002", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), ProductionDate = DateTime.UtcNow.AddDays(-10) },
            new() { Id = Guid.NewGuid(), ProductCode = "P003", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.O, Rh = RhFactor.Negative }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), ProductionDate = DateTime.UtcNow.AddDays(-10) },
            new() { Id = Guid.NewGuid(), ProductCode = "ISS001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.Issued, UpdatedAt = DateTime.UtcNow.AddDays(-2), ProductionDate = DateTime.UtcNow.AddDays(-10) }
        }.AsQueryable().BuildMock();

        var settings = new List<InventorySetting>
        {
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.RedBloodCells, BloodType = BloodType.A, RhFactor = RhFactor.Positive, MinimumLevel = 5, WarningLevel = 10, EmergencyReserve = 2 }
        }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(allProducts);

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        var result = await _inventoryService.GetBloodTypeBalanceAnalysisAsync();

        result.Should().NotBeNull();
        result.InventoryByType.Should().NotBeEmpty();
        result.OverallBalanceScore.Should().BeGreaterOrEqualTo(0);
        result.SupplyDemandRatio.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetInventoryAlertsAsync_LowStockItems_ReturnsAlerts()
    {
        var products = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "P001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), ProductionDate = DateTime.UtcNow.AddDays(-10) }
        }.AsQueryable().BuildMock();

        var settings = new List<InventorySetting>
        {
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.RedBloodCells, BloodType = BloodType.A, RhFactor = RhFactor.Positive, MinimumLevel = 10, WarningLevel = 20, EmergencyReserve = 5 }
        }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(products);

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        var result = await _inventoryService.GetInventoryAlertsAsync();

        result.Should().NotBeEmpty();
        result.Should().Contain(a => a.AlertType == "LowStock");
    }

    [Fact]
    public async Task GetInventoryItemsAsync_WithPagination_ReturnsCorrectPage()
    {
        var allProducts = Enumerable.Range(1, 25)
            .Select(i => new BloodProduct
            {
                Id = Guid.NewGuid(),
                ProductCode = $"P{i:D3}",
                ProductType = BloodProductType.RedBloodCells,
                BloodGroup = new BloodGroup { ABO = BloodType.O, Rh = RhFactor.Positive },
                Volume = 250,
                ProductionDate = DateTime.UtcNow.AddDays(-i),
                ExpiryDate = DateTime.UtcNow.AddDays(35 - i),
                Status = InventoryStatus.InStock
            })
            .ToList()
            .AsQueryable().BuildMock();

        var query = new SearchInventoryQuery(
            ProductType: null,
            BloodType: null,
            RhFactor: null,
            Status: null,
            StorageLocation: null,
            ExpiringSoon: null,
            PageNumber: 2,
            PageSize: 10);

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(allProducts);

        var result = await _inventoryService.GetInventoryItemsAsync(query);

        result.Should().NotBeNull();
        result.Items.Should().HaveCount(10);
        result.TotalCount.Should().Be(25);
        result.PageNumber.Should().Be(2);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task CheckAndSendAlertsAsync_WithLowStock_SendsNotifications()
    {
        var products = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "P001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.B, Rh = RhFactor.Negative }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30) }
        }.AsQueryable().BuildMock();

        var settings = new List<InventorySetting>
        {
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.RedBloodCells, BloodType = BloodType.B, RhFactor = RhFactor.Negative, MinimumLevel = 5, WarningLevel = 10, EmergencyReserve = 2 }
        }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(products);

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        await _inventoryService.CheckAndSendAlertsAsync();

        _notificationServiceMock.Verify(
            n => n.SendInventoryAlertAsync(
                It.Is<string>(t => t == "LowStock"),
                It.IsAny<string>(),
                It.Is<string>(s => s == "High"),
                It.IsAny<CancellationToken>()),
            Times.AtLeastOnce);
    }

    [Fact]
    public async Task GetInventorySettingsAsync_ReturnsSettingsFromDatabase()
    {
        var settings = new List<InventorySetting>
        {
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.RedBloodCells, BloodType = BloodType.A, RhFactor = RhFactor.Positive, MinimumLevel = 10, WarningLevel = 20, EmergencyReserve = 5 },
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.RedBloodCells, BloodType = BloodType.O, RhFactor = RhFactor.Negative, MinimumLevel = 8, WarningLevel = 16, EmergencyReserve = 4 },
            new() { Id = Guid.NewGuid(), ProductType = BloodProductType.Plasma, BloodType = BloodType.B, RhFactor = RhFactor.Positive, MinimumLevel = 15, WarningLevel = 30, EmergencyReserve = 7 }
        }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        var result = await _inventoryService.GetInventorySettingsAsync();

        result.Should().NotBeNull();
        result.SafetyStockLevels.Should().HaveCount(3);
        result.ExpirationWarningHours.Should().Be(24);
        result.EmergencyReservePercent.Should().Be(20);
        result.SafetyStockLevels.Should().Contain(s => s.BloodType == BloodType.A && s.RhFactor == RhFactor.Positive && s.MinimumLevel == 10);
    }

    [Fact]
    public async Task SetSafetyStockLevelAsync_CreatesNewSetting()
    {
        var settings = new List<InventorySetting>().AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        await _inventoryService.SetSafetyStockLevelAsync(
            BloodProductType.RedBloodCells,
            BloodType.AB,
            RhFactor.Negative,
            12);

        _unitOfWorkMock.Verify(u => u.InventorySettings.AddAsync(
            It.Is<InventorySetting>(s =>
                s.ProductType == BloodProductType.RedBloodCells &&
                s.BloodType == BloodType.AB &&
                s.RhFactor == RhFactor.Negative &&
                s.MinimumLevel == 12),
            It.IsAny<CancellationToken>()), Times.Once);

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetSafetyStockLevelAsync_UpdatesExistingSetting()
    {
        var existingSetting = new InventorySetting
        {
            Id = Guid.NewGuid(),
            ProductType = BloodProductType.RedBloodCells,
            BloodType = BloodType.O,
            RhFactor = RhFactor.Positive,
            MinimumLevel = 5,
            WarningLevel = 10,
            EmergencyReserve = 2
        };

        var settings = new List<InventorySetting> { existingSetting }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        await _inventoryService.SetSafetyStockLevelAsync(
            BloodProductType.RedBloodCells,
            BloodType.O,
            RhFactor.Positive,
            20);

        _unitOfWorkMock.Verify(u => u.InventorySettings.Update(
            It.Is<InventorySetting>(s =>
                s.MinimumLevel == 20 &&
                s.BloodType == BloodType.O)),
            Times.Once);

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetInventoryItemsAsync_WithBloodTypeFilter_FiltersCorrectly()
    {
        var products = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "P001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-5) },
            new() { Id = Guid.NewGuid(), ProductCode = "P002", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.B, Rh = RhFactor.Negative }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-5) },
            new() { Id = Guid.NewGuid(), ProductCode = "P003", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Negative }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-5) },
            new() { Id = Guid.NewGuid(), ProductCode = "P004", ProductType = BloodProductType.Plasma, BloodGroup = new BloodGroup { ABO = BloodType.O, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 200, ProductionDate = DateTime.UtcNow.AddDays(-5) }
        }.AsQueryable().BuildMock();

        var query = new SearchInventoryQuery(
            ProductType: null,
            BloodType: BloodType.A,
            RhFactor: null,
            Status: null,
            StorageLocation: null,
            ExpiringSoon: null,
            PageNumber: 1,
            PageSize: 20);

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(products);

        var result = await _inventoryService.GetInventoryItemsAsync(query);

        result.Should().NotBeNull();
        result.TotalCount.Should().Be(2);
        result.Items.Should().OnlyContain(i => i.BloodType == BloodType.A);
    }

    [Fact]
    public async Task GetInventoryAlertsAsync_ExpiringProducts_ReturnsExpiringSoonAlerts()
    {
        var products = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "EXP001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.O, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddHours(12), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-35) },
            new() { Id = Guid.NewGuid(), ProductCode = "SAFE001", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-10) }
        }.AsQueryable().BuildMock();

        var settings = new List<InventorySetting>().AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(products);

        _unitOfWorkMock.Setup(u => u.InventorySettings.Query())
            .Returns(settings);

        var result = await _inventoryService.GetInventoryAlertsAsync();

        result.Should().Contain(a => a.AlertType == "ExpiringSoon");
        result.Should().Contain(a => a.Message.Contains("EXP001"));
    }

    [Fact]
    public async Task GetInventorySummaryAsync_ReturnsOnlyInStockItems()
    {
        var products = new List<BloodProduct>
        {
            new() { Id = Guid.NewGuid(), ProductCode = "INSTOCK01", ProductType = BloodProductType.RedBloodCells, BloodGroup = new BloodGroup { ABO = BloodType.O, Rh = RhFactor.Positive }, Status = InventoryStatus.InStock, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 250, ProductionDate = DateTime.UtcNow.AddDays(-5) },
            new() { Id = Guid.NewGuid(), ProductCode = "ISSUED01", ProductType = BloodProductType.Plasma, BloodGroup = new BloodGroup { ABO = BloodType.A, Rh = RhFactor.Negative }, Status = InventoryStatus.Issued, ExpiryDate = DateTime.UtcNow.AddDays(30), Volume = 200, ProductionDate = DateTime.UtcNow.AddDays(-5) },
            new() { Id = Guid.NewGuid(), ProductCode = "QUARANTINED01", ProductType = BloodProductType.Platelets, BloodGroup = new BloodGroup { ABO = BloodType.B, Rh = RhFactor.Positive }, Status = InventoryStatus.Quarantined, ExpiryDate = DateTime.UtcNow.AddDays(5), Volume = 50, ProductionDate = DateTime.UtcNow.AddDays(-2) }
        }.AsQueryable().BuildMock();

        _unitOfWorkMock.Setup(u => u.BloodProducts.Query())
            .Returns(products);

        var result = await _inventoryService.GetInventorySummaryAsync();

        result.Should().HaveCount(1);
        result.First().ProductCode.Should().Be("INSTOCK01");
    }
}
