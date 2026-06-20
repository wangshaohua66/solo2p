using Microsoft.EntityFrameworkCore;
using FireTraining.Models;

namespace FireTraining.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Firefighter> Firefighters { get; set; }
    public DbSet<FireStation> FireStations { get; set; }
    public DbSet<FirefighterLevel> FirefighterLevels { get; set; }
    public DbSet<Specialty> Specialties { get; set; }
    public DbSet<Course> Courses { get; set; }
    public DbSet<TrainingPlan> TrainingPlans { get; set; }
    public DbSet<TrainingPlanStation> TrainingPlanStations { get; set; }
    public DbSet<TrainingSchedule> TrainingSchedules { get; set; }
    public DbSet<ScheduleParticipant> ScheduleParticipants { get; set; }
    public DbSet<Room> Rooms { get; set; }
    public DbSet<Question> Questions { get; set; }
    public DbSet<QuestionCategory> QuestionCategories { get; set; }
    public DbSet<ExamPaper> ExamPapers { get; set; }
    public DbSet<ExamPaperQuestion> ExamPaperQuestions { get; set; }
    public DbSet<Exam> Exams { get; set; }
    public DbSet<ExamScore> ExamScores { get; set; }
    public DbSet<PracticalExam> PracticalExams { get; set; }
    public DbSet<PracticalExamItem> PracticalExamItems { get; set; }
    public DbSet<PracticalScoreItem> PracticalScoreItems { get; set; }
    public DbSet<Equipment> Equipment { get; set; }
    public DbSet<EquipmentReservation> EquipmentReservations { get; set; }
    public DbSet<LearningProgress> LearningProgresses { get; set; }
    public DbSet<LearningProgressDetail> LearningProgressDetails { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<QuestionCategory>()
            .HasOne(qc => qc.Parent)
            .WithMany(qc => qc.Children)
            .HasForeignKey(qc => qc.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TrainingSchedule>()
            .HasOne(ts => ts.Course)
            .WithMany(c => c.Schedules)
            .HasForeignKey(ts => ts.CourseId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TrainingSchedule>()
            .HasOne(ts => ts.Room)
            .WithMany(r => r.Schedules)
            .HasForeignKey(ts => ts.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ExamPaperQuestion>()
            .HasOne(epq => epq.ExamPaper)
            .WithMany(ep => ep.PaperQuestions)
            .HasForeignKey(epq => epq.ExamPaperId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ExamPaperQuestion>()
            .HasOne(epq => epq.Question)
            .WithMany()
            .HasForeignKey(epq => epq.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Exam>()
            .HasOne(e => e.ExamPaper)
            .WithMany(ep => ep.Exams)
            .HasForeignKey(e => e.ExamPaperId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ExamScore>()
            .HasOne(es => es.Exam)
            .WithMany(e => e.Scores)
            .HasForeignKey(es => es.ExamId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ExamScore>()
            .HasOne(es => es.Firefighter)
            .WithMany()
            .HasForeignKey(es => es.FirefighterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PracticalExamItem>()
            .HasOne(pei => pei.PracticalExam)
            .WithMany(pe => pe.Items)
            .HasForeignKey(pei => pei.PracticalExamId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PracticalScoreItem>()
            .HasOne(psi => psi.ExamScore)
            .WithMany(es => es.PracticalScoreItems)
            .HasForeignKey(psi => psi.ExamScoreId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PracticalScoreItem>()
            .HasOne(psi => psi.PracticalExamItem)
            .WithMany(pei => pei.ScoreItems)
            .HasForeignKey(psi => psi.PracticalExamItemId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<EquipmentReservation>()
            .HasOne(er => er.Equipment)
            .WithMany(e => e.Reservations)
            .HasForeignKey(er => er.EquipmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TrainingPlanStation>()
            .HasOne(tps => tps.TrainingPlan)
            .WithMany(tp => tp.PlanStations)
            .HasForeignKey(tps => tps.TrainingPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TrainingPlanStation>()
            .HasOne(tps => tps.FireStation)
            .WithMany()
            .HasForeignKey(tps => tps.FireStationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<LearningProgress>()
            .HasOne(lp => lp.Firefighter)
            .WithMany()
            .HasForeignKey(lp => lp.FirefighterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<LearningProgressDetail>()
            .HasOne(lpd => lpd.LearningProgress)
            .WithMany(lp => lp.Details)
            .HasForeignKey(lpd => lpd.LearningProgressId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ScheduleParticipant>()
            .HasOne(sp => sp.TrainingSchedule)
            .WithMany(ts => ts.Participants)
            .HasForeignKey(sp => sp.TrainingScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ScheduleParticipant>()
            .HasOne(sp => sp.Firefighter)
            .WithMany()
            .HasForeignKey(sp => sp.FirefighterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<FirefighterLevel>()
            .HasIndex(fl => fl.Name)
            .IsUnique();

        modelBuilder.Entity<Specialty>()
            .HasIndex(s => s.Name)
            .IsUnique();

        modelBuilder.Entity<FireStation>()
            .HasIndex(fs => fs.Name)
            .IsUnique();

        modelBuilder.Entity<Room>()
            .HasIndex(r => r.Name)
            .IsUnique();

        modelBuilder.Entity<Equipment>()
            .HasIndex(e => e.Name);

        modelBuilder.Entity<Equipment>()
            .HasIndex(e => e.Category);

        modelBuilder.Entity<Question>()
            .HasIndex(q => q.CategoryId);

        modelBuilder.Entity<Question>()
            .HasIndex(q => q.Type);

        modelBuilder.Entity<Question>()
            .HasIndex(q => q.Difficulty);

        modelBuilder.Entity<TrainingSchedule>()
            .HasIndex(ts => new { ts.RoomId, ts.ScheduleDate, ts.StartHour });

        modelBuilder.Entity<TrainingSchedule>()
            .HasIndex(ts => new { ts.ScheduleDate, ts.DayOfWeek });

        modelBuilder.Entity<EquipmentReservation>()
            .HasIndex(er => new { er.EquipmentId, er.StartTime, er.EndTime });

        modelBuilder.Entity<EquipmentReservation>()
            .HasIndex(er => er.Status);

        modelBuilder.Entity<ExamScore>()
            .HasIndex(es => new { es.ExamId, es.FirefighterId })
            .IsUnique();

        modelBuilder.Entity<LearningProgress>()
            .HasIndex(lp => new { lp.FirefighterId, lp.LevelId, lp.CycleStartDate })
            .IsUnique();
    }
}
