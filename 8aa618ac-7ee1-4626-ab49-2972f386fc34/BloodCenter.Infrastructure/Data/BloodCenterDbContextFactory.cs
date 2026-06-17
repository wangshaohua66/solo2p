using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace BloodCenter.Infrastructure.Data;

public class BloodCenterDbContextFactory : IDesignTimeDbContextFactory<BloodCenterDbContext>
{
    public BloodCenterDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json")
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Server=localhost;Port=3306;Database=BloodCenterDb;User=root;Password=;CharSet=utf8mb4;AllowPublicKeyRetrieval=True;SslMode=None;";

        var optionsBuilder = new DbContextOptionsBuilder<BloodCenterDbContext>();
        optionsBuilder.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString));

        return new BloodCenterDbContext(optionsBuilder.Options);
    }
}
