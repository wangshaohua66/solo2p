using Microsoft.EntityFrameworkCore;
using PotteryStudio.Data;
using PotteryStudio.Models;

namespace PotteryStudio.Services;

public class GlazeRecipeService : IGlazeRecipeService
{
    private readonly AppDbContext _context;

    public GlazeRecipeService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<GlazeRecipe>> GetRecipesAsync(
        PagedQuery query,
        FiringType? firingType = null,
        bool? isArchived = null)
    {
        var queryable = _context.GlazeRecipes
            .Where(r => r.ParentId == null || !r.IsCurrentVersion)
            .OrderByDescending(r => r.CreatedAt)
            .AsQueryable();

        if (firingType.HasValue)
            queryable = queryable.Where(r => r.FiringType == firingType.Value);

        if (isArchived.HasValue)
            queryable = queryable.Where(r => r.IsArchived == isArchived.Value);

        if (!string.IsNullOrEmpty(query.Keyword))
        {
            var keyword = query.Keyword.ToLower();
            queryable = queryable.Where(r => 
                r.Name.ToLower().Contains(keyword) || 
                r.Code.ToLower().Contains(keyword) ||
                r.Description.ToLower().Contains(keyword));
        }

        var totalCount = await queryable.CountAsync();

        var items = await queryable
            .Skip((query.PageIndex - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResult.Create(items, totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<GlazeRecipe?> GetRecipeByIdAsync(Guid id)
    {
        return await _context.GlazeRecipes
            .Include(r => r.Parent)
            .Include(r => r.Children)
            .FirstOrDefaultAsync(r => r.Id == id);
    }

    public async Task<List<GlazeRecipe>> GetRecipeTreeAsync(Guid? rootId = null)
    {
        var roots = await _context.GlazeRecipes
            .Where(r => r.ParentId == rootId)
            .OrderBy(r => r.Name)
            .ToListAsync();

        return roots;
    }

    public async Task<List<GlazeRecipe>> GetRecipeVersionsAsync(Guid recipeId)
    {
        var recipe = await _context.GlazeRecipes.FindAsync(recipeId);
        if (recipe == null) return new List<GlazeRecipe>();

        var rootId = GetRootId(recipe);

        var allVersions = new List<GlazeRecipe>();
        await LoadAllChildrenAsync(rootId, allVersions, 0);

        return allVersions;
    }

    public async Task<List<GlazeRecipe>> GetRecipeLineageAsync(Guid recipeId)
    {
        var recipe = await _context.GlazeRecipes
            .Include(r => r.Parent)
            .FirstOrDefaultAsync(r => r.Id == recipeId);

        if (recipe == null) return new List<GlazeRecipe>();

        var lineage = new List<GlazeRecipe>();
        var current = recipe;

        while (current != null)
        {
            lineage.Insert(0, current);
            current = current.Parent;
            if (current != null)
            {
                current = await _context.GlazeRecipes
                    .Include(r => r.Parent)
                    .FirstOrDefaultAsync(r => r.Id == current.Id);
            }
        }

        return lineage;
    }

    public async Task<GlazeRecipe> CreateRecipeAsync(GlazeRecipe recipe, Guid? createdById, string createdByName)
    {
        if (await _context.GlazeRecipes.AnyAsync(r => r.Code == recipe.Code))
            throw new InvalidOperationException("配方代码已存在");

        recipe.Id = Guid.NewGuid();
        recipe.Version = 1;
        recipe.CreatedById = createdById ?? Guid.Empty;
        recipe.CreatedByName = createdByName;
        recipe.CreatedAt = DateTime.UtcNow;
        recipe.UpdatedAt = DateTime.UtcNow;
        recipe.IsCurrentVersion = true;
        recipe.IsArchived = false;

        if (recipe.Ingredients == null)
            recipe.Ingredients = new List<GlazeIngredient>();

        _context.GlazeRecipes.Add(recipe);
        await _context.SaveChangesAsync();

        return recipe;
    }

    public async Task<GlazeRecipe> UpdateRecipeAsync(Guid id, GlazeRecipe recipe)
    {
        var existing = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("配方不存在");

        existing.Name = recipe.Name;
        existing.Description = recipe.Description;
        existing.FiringType = recipe.FiringType;
        existing.TemperatureMin = recipe.TemperatureMin;
        existing.TemperatureMax = recipe.TemperatureMax;
        existing.Atmosphere = recipe.Atmosphere;
        existing.Ingredients = recipe.Ingredients ?? new List<GlazeIngredient>();
        existing.Notes = recipe.Notes;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task DeleteRecipeAsync(Guid id)
    {
        var recipe = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("配方不存在");

        if (recipe.Children != null && recipe.Children.Count > 0)
            throw new InvalidOperationException("该配方有子版本，无法删除");

        var hasPieces = await _context.PieceArchives.AnyAsync(p => p.GlazeRecipeId == id);
        if (hasPieces)
            throw new InvalidOperationException("该配方已被作品使用，无法删除");

        _context.GlazeRecipes.Remove(recipe);
        await _context.SaveChangesAsync();
    }

    public async Task<GlazeRecipe> CloneRecipeAsync(Guid id, string newName, Guid createdById, string createdByName)
    {
        var source = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("源配方不存在");

        var clone = new GlazeRecipe
        {
            Id = Guid.NewGuid(),
            Name = newName,
            Code = GenerateNewCode(),
            Version = 1,
            FiringType = source.FiringType,
            TemperatureMin = source.TemperatureMin,
            TemperatureMax = source.TemperatureMax,
            Atmosphere = source.Atmosphere,
            Description = $"克隆自 {source.Name}\n\n{source.Description}",
            Ingredients = source.Ingredients?.Select(i => new GlazeIngredient
            {
                Name = i.Name,
                Percentage = i.Percentage,
                Notes = i.Notes
            }).ToList() ?? new List<GlazeIngredient>(),
            EffectImage = source.EffectImage,
            EffectThumbnail = source.EffectThumbnail,
            CreatedById = createdById,
            CreatedByName = createdByName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsCurrentVersion = true,
            IsArchived = false,
            SourceVersion = source.Id
        };

        _context.GlazeRecipes.Add(clone);
        await _context.SaveChangesAsync();
        return clone;
    }

    public async Task<GlazeRecipe> CreateVersionAsync(
        Guid parentId, 
        GlazeRecipe recipe, 
        Guid createdById, 
        string createdByName)
    {
        var parent = await _context.GlazeRecipes.FindAsync(parentId)
            ?? throw new InvalidOperationException("父配方不存在");

        parent.IsCurrentVersion = false;
        parent.UpdatedAt = DateTime.UtcNow;

        var newVersion = new GlazeRecipe
        {
            Id = Guid.NewGuid(),
            ParentId = parentId,
            Name = recipe.Name,
            Code = parent.Code,
            Version = parent.Version + 1,
            FiringType = recipe.FiringType,
            TemperatureMin = recipe.TemperatureMin,
            TemperatureMax = recipe.TemperatureMax,
            Atmosphere = recipe.Atmosphere,
            Description = recipe.Description,
            Ingredients = recipe.Ingredients ?? new List<GlazeIngredient>(),
            EffectImage = recipe.EffectImage,
            EffectThumbnail = recipe.EffectThumbnail,
            Notes = recipe.Notes,
            CreatedById = createdById,
            CreatedByName = createdByName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsCurrentVersion = true,
            IsArchived = false
        };

        _context.GlazeRecipes.Add(newVersion);
        await _context.SaveChangesAsync();
        return newVersion;
    }

    public async Task<GlazeRecipe> ArchiveRecipeAsync(Guid id)
    {
        var recipe = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("配方不存在");

        recipe.IsArchived = true;
        recipe.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return recipe;
    }

    public async Task<GlazeRecipe> UnarchiveRecipeAsync(Guid id)
    {
        var recipe = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("配方不存在");

        recipe.IsArchived = false;
        recipe.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return recipe;
    }

    public async Task<GlazeRecipe> UploadEffectImageAsync(Guid id, string imageUrl, string thumbnailUrl)
    {
        var recipe = await _context.GlazeRecipes.FindAsync(id)
            ?? throw new InvalidOperationException("配方不存在");

        recipe.EffectImage = imageUrl;
        recipe.EffectThumbnail = thumbnailUrl;
        recipe.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return recipe;
    }

    private Guid GetRootId(GlazeRecipe recipe)
    {
        var current = recipe;
        while (current.ParentId != null)
        {
            var parent = _context.GlazeRecipes.Find(current.ParentId.Value);
            if (parent == null) break;
            current = parent;
        }
        return current.Id;
    }

    private async Task LoadAllChildrenAsync(Guid parentId, List<GlazeRecipe> result, int depth)
    {
        var parent = await _context.GlazeRecipes.FindAsync(parentId);
        if (parent != null)
        {
            result.Add(parent);
        }

        var children = await _context.GlazeRecipes
            .Where(r => r.ParentId == parentId)
            .OrderBy(r => r.Version)
            .ToListAsync();

        foreach (var child in children)
        {
            await LoadAllChildrenAsync(child.Id, result, depth + 1);
        }
    }

    private static string GenerateNewCode()
    {
        return $"G-{Guid.NewGuid().ToString().Substring(0, 6).ToUpper()}";
    }
}
