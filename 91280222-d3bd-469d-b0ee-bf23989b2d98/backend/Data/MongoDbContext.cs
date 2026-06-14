using BlueprintReview.Configuration;
using BlueprintReview.Models;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace BlueprintReview.Data;

public interface IMongoDbContext
{
    IMongoCollection<User> Users { get; }
    IMongoCollection<Project> Projects { get; }
    IMongoCollection<Document> Documents { get; }
    IMongoCollection<Annotation> Annotations { get; }
    IMongoCollection<ReviewWorkflow> ReviewWorkflows { get; }
    IMongoCollection<ReviewWorkflowTemplate> ReviewWorkflowTemplates { get; }
    IMongoDatabase Database { get; }
}

public class MongoDbContext : IMongoDbContext
{
    private readonly IMongoDatabase _database;

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);

        Users = _database.GetCollection<User>("users");
        Projects = _database.GetCollection<Project>("projects");
        Documents = _database.GetCollection<Document>("documents");
        Annotations = _database.GetCollection<Annotation>("annotations");
        ReviewWorkflows = _database.GetCollection<ReviewWorkflow>("reviewWorkflows");
        ReviewWorkflowTemplates = _database.GetCollection<ReviewWorkflowTemplate>("reviewWorkflowTemplates");

        CreateIndexes();
    }

    public IMongoCollection<User> Users { get; }
    public IMongoCollection<Project> Projects { get; }
    public IMongoCollection<Document> Documents { get; }
    public IMongoCollection<Annotation> Annotations { get; }
    public IMongoCollection<ReviewWorkflow> ReviewWorkflows { get; }
    public IMongoCollection<ReviewWorkflowTemplate> ReviewWorkflowTemplates { get; }
    public IMongoDatabase Database => _database;

    private void CreateIndexes()
    {
        var indexModels = new List<CreateIndexModel<User>>
        {
            new(Builders<User>.IndexKeys.Ascending(u => u.Email), new CreateIndexOptions { Unique = true })
        };
        Users.Indexes.CreateMany(indexModels);

        var projectIndexes = new List<CreateIndexModel<Project>>
        {
            new(Builders<Project>.IndexKeys.Ascending(p => p.CreatedBy)),
            new(Builders<Project>.IndexKeys.Ascending(p => p.Status)),
            new(Builders<Project>.IndexKeys.Ascending("members.userId"))
        };
        Projects.Indexes.CreateMany(projectIndexes);

        var docIndexes = new List<CreateIndexModel<Document>>
        {
            new(Builders<Document>.IndexKeys.Ascending(d => d.ProjectId)),
            new(Builders<Document>.IndexKeys.Ascending(d => d.Status))
        };
        Documents.Indexes.CreateMany(docIndexes);

        var annotationIndexes = new List<CreateIndexModel<Annotation>>
        {
            new(Builders<Annotation>.IndexKeys.Ascending(a => a.DocumentId)),
            new(Builders<Annotation>.IndexKeys.Ascending(a => a.VersionId)),
            new(Builders<Annotation>.IndexKeys.Ascending(a => a.Status)),
            new(Builders<Annotation>.IndexKeys.Combine(
                Builders<Annotation>.IndexKeys.Ascending(a => a.DocumentId),
                Builders<Annotation>.IndexKeys.Ascending(a => a.VersionId),
                Builders<Annotation>.IndexKeys.Ascending(a => a.PageNumber)
            ))
        };
        Annotations.Indexes.CreateMany(annotationIndexes);

        var workflowIndexes = new List<CreateIndexModel<ReviewWorkflow>>
        {
            new(Builders<ReviewWorkflow>.IndexKeys.Ascending(w => w.DocumentId)),
            new(Builders<ReviewWorkflow>.IndexKeys.Ascending(w => w.Status))
        };
        ReviewWorkflows.Indexes.CreateMany(workflowIndexes);
    }
}
