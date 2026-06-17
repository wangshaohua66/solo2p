using BloodCenter.Core.Interfaces;
using FluentValidation;

namespace BloodCenter.API.Validators;

public class CreateDonorDtoValidator : AbstractValidator<CreateDonorDto>
{
    public CreateDonorDtoValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100).WithMessage("First name must not exceed 100 characters");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100).WithMessage("Last name must not exceed 100 characters");

        RuleFor(x => x.DateOfBirth)
            .NotEmpty().WithMessage("Date of birth is required")
            .LessThan(DateTime.Today).WithMessage("Date of birth must be in the past")
            .Must(BeAtLeast18).WithMessage("Donor must be at least 18 years old")
            .Must(BeAtMost60).WithMessage("Donor must be at most 60 years old");

        RuleFor(x => x.Gender)
            .NotEmpty().WithMessage("Gender is required")
            .Must(g => g == "M" || g == "F" || g == "Male" || g == "Female").WithMessage("Gender must be M, F, Male, or Female");

        RuleFor(x => x.IdCardNumber)
            .NotEmpty().WithMessage("ID card number is required")
            .MaximumLength(50).WithMessage("ID card number must not exceed 50 characters");

        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("Phone number is required")
            .Matches(@"^1[3-9]\d{9}$").WithMessage("Phone number must be a valid Chinese mobile number");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .MaximumLength(100).WithMessage("Email must not exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.Occupation)
            .MaximumLength(100).WithMessage("Occupation must not exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Occupation));
    }

    private static bool BeAtLeast18(DateTime dateOfBirth)
    {
        return dateOfBirth <= DateTime.Today.AddYears(-18);
    }

    private static bool BeAtMost60(DateTime dateOfBirth)
    {
        return dateOfBirth >= DateTime.Today.AddYears(-60);
    }
}

public class UpdateDonorDtoValidator : AbstractValidator<UpdateDonorDto>
{
    public UpdateDonorDtoValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .MaximumLength(100);

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .MaximumLength(100);

        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("Phone number is required")
            .Matches(@"^1[3-9]\d{9}$").WithMessage("Invalid phone number format");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email format")
            .When(x => !string.IsNullOrEmpty(x.Email));
    }
}

public class CreateDonationDtoValidator : AbstractValidator<CreateDonationDto>
{
    public CreateDonationDtoValidator()
    {
        RuleFor(x => x.DonorId)
            .NotEmpty().WithMessage("Donor ID is required");

        RuleFor(x => x.CollectionSiteId)
            .NotEmpty().WithMessage("Collection site ID is required");

        RuleFor(x => x.NurseId)
            .NotEmpty().WithMessage("Nurse ID is required");

        RuleFor(x => x.DonationDate)
            .NotEmpty().WithMessage("Donation date is required")
            .LessThanOrEqualTo(DateTime.UtcNow).WithMessage("Donation date cannot be in the future");

        RuleFor(x => x.Volume)
            .NotEmpty().WithMessage("Volume is required")
            .Must(v => v == 350 || v == 400).WithMessage("Volume must be 350ml or 400ml");

        RuleFor(x => x.Arm)
            .MaximumLength(10).WithMessage("Arm must not exceed 10 characters")
            .Must(a => a == null || a == "Left" || a == "Right").WithMessage("Arm must be Left or Right")
            .When(x => !string.IsNullOrEmpty(x.Arm));

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Notes must not exceed 1000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}

public class CreateInitialScreeningDtoValidator : AbstractValidator<CreateInitialScreeningDto>
{
    public CreateInitialScreeningDtoValidator()
    {
        RuleFor(x => x.TechnicianId)
            .NotEmpty().WithMessage("Technician ID is required");

        RuleFor(x => x.Hemoglobin)
            .GreaterThan(0).WithMessage("Hemoglobin must be greater than 0")
            .LessThanOrEqualTo(250).WithMessage("Hemoglobin must not exceed 250 g/L");

        RuleFor(x => x.ALT)
            .GreaterThan(0).WithMessage("ALT must be greater than 0")
            .LessThanOrEqualTo(1000).WithMessage("ALT must not exceed 1000 U/L");
    }
}

public class CreateBloodTestDtoValidator : AbstractValidator<CreateBloodTestDto>
{
    public CreateBloodTestDtoValidator()
    {
        RuleFor(x => x.DonationId)
            .NotEmpty().WithMessage("Donation ID is required");

        RuleFor(x => x.TechnicianId)
            .NotEmpty().WithMessage("Technician ID is required");

        RuleFor(x => x.Result)
            .NotEqual(Infrastructure.Entities.Enums.TestResult.Pending)
            .WithMessage("Test result must not be Pending when recording");

        RuleFor(x => x.TestMethod)
            .MaximumLength(200).WithMessage("Test method must not exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.TestMethod));

        RuleFor(x => x.ReagentLot)
            .MaximumLength(100).WithMessage("Reagent lot must not exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.ReagentLot));
    }
}

public class CreateBloodRequestDtoValidator : AbstractValidator<CreateBloodRequestDto>
{
    public CreateBloodRequestDtoValidator()
    {
        RuleFor(x => x.HospitalId)
            .NotEmpty().WithMessage("Hospital ID is required");

        RuleFor(x => x.PatientName)
            .NotEmpty().WithMessage("Patient name is required")
            .MaximumLength(100);

        RuleFor(x => x.PatientId)
            .NotEmpty().WithMessage("Patient ID is required")
            .MaximumLength(50);

        RuleFor(x => x.QuantityRequested)
            .GreaterThan(0).WithMessage("Quantity requested must be greater than 0")
            .LessThanOrEqualTo(100).WithMessage("Quantity requested must not exceed 100 units per request");

        RuleFor(x => x.RequiredDate)
            .NotEmpty().WithMessage("Required date is required");

        RuleFor(x => x.Ward)
            .NotEmpty().WithMessage("Ward is required")
            .MaximumLength(100);

        RuleFor(x => x.RequestedBy)
            .NotEmpty().WithMessage("Requested by is required")
            .MaximumLength(100);

        RuleFor(x => x.PatientAge)
            .GreaterThan(0).WithMessage("Patient age must be greater than 0")
            .LessThan(150).WithMessage("Patient age must be less than 150")
            .When(x => x.PatientAge.HasValue);
    }
}

public class LoginRequestDtoValidator : AbstractValidator<LoginRequestDto>
{
    public LoginRequestDtoValidator()
    {
        RuleFor(x => x.UserName)
            .NotEmpty().WithMessage("Username is required")
            .MaximumLength(50);

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(6).WithMessage("Password must be at least 6 characters");
    }
}
