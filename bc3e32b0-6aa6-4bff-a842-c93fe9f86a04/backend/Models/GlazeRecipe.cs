using System.Text.Json.Serialization;

namespace PotteryStudio.Models;

public class GlazeIngredient
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string? Note { get; set; }
}

public class GlazeRecipe
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public Guid? ParentId { get; set; }
    
    [JsonIgnore]
    public GlazeRecipe? Parent { get; set; }
    
    public int Version { get; set; } = 1;
    public bool IsArchived { get; set; }
    public List<GlazeIngredient> Ingredients { get; set; } = new();
    public FiringType FiringType { get; set; } = FiringType.Glaze;
    public decimal TemperatureMin { get; set; }
    public decimal TemperatureMax { get; set; }
    public string Atmosphere { get; set; } = "氧化焰";
    public string? Description { get; set; }
    public string? EffectImage { get; set; }
    public string? EffectThumbnail { get; set; }
    public Guid CreatedById { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public ICollection<GlazeRecipe> Children { get; set; } = new List<GlazeRecipe>();
    
    public ICollection<PieceArchive> Pieces { get; set; } = new List<PieceArchive>();
}
