using FluentValidation;
using HazChemSupervision.DTOs;

namespace HazChemSupervision.Validators;

public class HazardRectificationCreateDtoValidator : AbstractValidator<HazardRectificationCreateDto>
{
    public HazardRectificationCreateDtoValidator()
    {
        RuleFor(x => x.WorkOrderNo)
            .NotEmpty().WithMessage("工单编号不能为空")
            .Length(1, 50).WithMessage("工单编号长度不能超过50个字符");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.Source)
            .IsInEnum().WithMessage("隐患来源无效");

        RuleFor(x => x.HazardDescription)
            .NotEmpty().WithMessage("隐患描述不能为空")
            .Length(1, 500).WithMessage("描述长度不能超过500个字符");

        RuleFor(x => x.Level)
            .IsInEnum().WithMessage("隐患等级无效");

        RuleFor(x => x.ResponsiblePerson)
            .NotEmpty().WithMessage("责任人不能为空")
            .Length(1, 50).WithMessage("责任人姓名长度不能超过50个字符");

        RuleFor(x => x.ResponsiblePersonPhone)
            .NotEmpty().WithMessage("责任人电话不能为空")
            .Length(1, 20).WithMessage("电话长度不能超过20个字符");

        RuleFor(x => x.DiscoveryTime)
            .NotEmpty().WithMessage("发现时间不能为空");

        RuleFor(x => x.Deadline)
            .NotEmpty().WithMessage("整改期限不能为空")
            .GreaterThan(x => x.DiscoveryTime).WithMessage("整改期限必须晚于发现时间");

        RuleFor(x => x.AcceptanceCriteria)
            .NotEmpty().WithMessage("验收标准不能为空")
            .Length(1, 2000).WithMessage("验收标准长度不能超过2000个字符");
    }
}

public class HazardRectificationStartDtoValidator : AbstractValidator<HazardRectificationStartDto>
{
    public HazardRectificationStartDtoValidator()
    {
        RuleFor(x => x.RectificationMeasures)
            .NotEmpty().WithMessage("整改措施不能为空")
            .Length(1, 2000).WithMessage("整改措施长度不能超过2000个字符");

        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");
    }
}

public class HazardRectificationCompleteDtoValidator : AbstractValidator<HazardRectificationCompleteDto>
{
    public HazardRectificationCompleteDtoValidator()
    {
        RuleFor(x => x.RectificationResult)
            .NotEmpty().WithMessage("整改结果不能为空")
            .Length(1, 2000).WithMessage("整改结果长度不能超过2000个字符");

        RuleFor(x => x.CompleteTime)
            .NotEmpty().WithMessage("完成时间不能为空");
    }
}

public class HazardRectificationInspectionDtoValidator : AbstractValidator<HazardRectificationInspectionDto>
{
    public HazardRectificationInspectionDtoValidator()
    {
        RuleFor(x => x.InspectorId)
            .GreaterThan(0).WithMessage("验收人员ID必须大于0");

        RuleFor(x => x.InspectorName)
            .NotEmpty().WithMessage("验收人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.InspectionComment)
            .NotEmpty().WithMessage("验收意见不能为空")
            .Length(1, 2000).WithMessage("验收意见长度不能超过2000个字符");

        RuleFor(x => x.InspectionTime)
            .NotEmpty().WithMessage("验收时间不能为空");
    }
}

public class EmergencyDrillCreateDtoValidator : AbstractValidator<EmergencyDrillCreateDto>
{
    public EmergencyDrillCreateDtoValidator()
    {
        RuleFor(x => x.PlanNo)
            .NotEmpty().WithMessage("计划编号不能为空")
            .Length(1, 50).WithMessage("计划编号长度不能超过50个字符");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("演练名称不能为空")
            .Length(1, 200).WithMessage("名称长度不能超过200个字符");

        RuleFor(x => x.EnterpriseId)
            .GreaterThan(0).WithMessage("企业ID必须大于0");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("演练类型无效");

        RuleFor(x => x.Year)
            .GreaterThan(2000).WithMessage("年份必须大于2000")
            .LessThan(2100).WithMessage("年份必须小于2100");

        RuleFor(x => x.Quarter)
            .InclusiveBetween(1, 4).WithMessage("季度必须在1-4之间");

        RuleFor(x => x.PlannedStartTime)
            .NotEmpty().WithMessage("计划开始时间不能为空");

        RuleFor(x => x.PlannedEndTime)
            .NotEmpty().WithMessage("计划结束时间不能为空")
            .GreaterThan(x => x.PlannedStartTime).WithMessage("计划结束时间必须晚于开始时间");

        RuleFor(x => x.ScenarioDescription)
            .NotEmpty().WithMessage("演练场景不能为空")
            .Length(1, 2000).WithMessage("场景描述长度不能超过2000个字符");

        RuleFor(x => x.Objectives)
            .NotEmpty().WithMessage("演练目标不能为空")
            .Length(1, 2000).WithMessage("目标长度不能超过2000个字符");

        RuleFor(x => x.PlannedParticipants)
            .GreaterThan(0).WithMessage("计划参与人数必须大于0");
    }
}

public class EmergencyDrillStartDtoValidator : AbstractValidator<EmergencyDrillStartDto>
{
    public EmergencyDrillStartDtoValidator()
    {
        RuleFor(x => x.StartTime)
            .NotEmpty().WithMessage("开始时间不能为空");

        RuleFor(x => x.ActualParticipants)
            .GreaterThan(0).WithMessage("实际参与人数必须大于0");
    }
}

public class EmergencyDrillCompleteDtoValidator : AbstractValidator<EmergencyDrillCompleteDto>
{
    public EmergencyDrillCompleteDtoValidator()
    {
        RuleFor(x => x.EndTime)
            .NotEmpty().WithMessage("结束时间不能为空");

        RuleFor(x => x.ExecutionRecord)
            .NotEmpty().WithMessage("执行记录不能为空")
            .Length(1, 2000).WithMessage("执行记录长度不能超过2000个字符");
    }
}

public class EmergencyDrillEvaluateDtoValidator : AbstractValidator<EmergencyDrillEvaluateDto>
{
    public EmergencyDrillEvaluateDtoValidator()
    {
        RuleFor(x => x.EvaluatorId)
            .GreaterThan(0).WithMessage("评估人员ID必须大于0");

        RuleFor(x => x.EvaluatorName)
            .NotEmpty().WithMessage("评估人员姓名不能为空")
            .Length(1, 50).WithMessage("姓名长度不能超过50个字符");

        RuleFor(x => x.EvaluationResult)
            .IsInEnum().WithMessage("评估结果无效");

        RuleFor(x => x.EvaluationComment)
            .NotEmpty().WithMessage("评估意见不能为空")
            .Length(1, 2000).WithMessage("评估意见长度不能超过2000个字符");

        RuleFor(x => x.EvaluationTime)
            .NotEmpty().WithMessage("评估时间不能为空");
    }
}

public class CertificateCreateDtoValidator : AbstractValidator<CertificateCreateDto>
{
    public CertificateCreateDtoValidator()
    {
        RuleFor(x => x.CertificateNo)
            .NotEmpty().WithMessage("证书编号不能为空")
            .Length(1, 50).WithMessage("证书编号长度不能超过50个字符");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("证书类型无效");

        RuleFor(x => x.HolderName)
            .NotEmpty().WithMessage("持证人姓名不能为空")
            .Length(1, 200).WithMessage("姓名长度不能超过200个字符");

        RuleFor(x => x.IssuingAuthority)
            .NotEmpty().WithMessage("发证机关不能为空")
            .Length(1, 100).WithMessage("发证机关长度不能超过100个字符");

        RuleFor(x => x.IssueDate)
            .NotEmpty().WithMessage("发证日期不能为空");

        RuleFor(x => x.ExpiryDate)
            .NotEmpty().WithMessage("有效期不能为空")
            .GreaterThan(x => x.IssueDate).WithMessage("有效期必须晚于发证日期");
    }
}

public class CertificateVerifyDtoValidator : AbstractValidator<CertificateVerifyDto>
{
    public CertificateVerifyDtoValidator()
    {
        RuleFor(x => x.CertificateNo)
            .NotEmpty().WithMessage("证书编号不能为空")
            .Length(1, 50).WithMessage("证书编号长度不能超过50个字符");

        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("证书类型无效");

        RuleFor(x => x.HolderName)
            .NotEmpty().WithMessage("持证人姓名不能为空")
            .Length(1, 200).WithMessage("姓名长度不能超过200个字符");
    }
}

public class AlertCreateDtoValidator : AbstractValidator<AlertCreateDto>
{
    public AlertCreateDtoValidator()
    {
        RuleFor(x => x.Type)
            .IsInEnum().WithMessage("预警类型无效");

        RuleFor(x => x.Level)
            .IsInEnum().WithMessage("预警级别无效");

        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("预警标题不能为空")
            .Length(1, 200).WithMessage("标题长度不能超过200个字符");

        RuleFor(x => x.Content)
            .NotEmpty().WithMessage("预警内容不能为空")
            .Length(1, 2000).WithMessage("内容长度不能超过2000个字符");
    }
}

public class AlertHandleDtoValidator : AbstractValidator<AlertHandleDto>
{
    public AlertHandleDtoValidator()
    {
        RuleFor(x => x.HandleResult)
            .NotEmpty().WithMessage("处理结果不能为空")
            .Length(1, 2000).WithMessage("处理结果长度不能超过2000个字符");

        RuleFor(x => x.HandlerUserId)
            .GreaterThan(0).WithMessage("处理人ID必须大于0");

        RuleFor(x => x.HandleTime)
            .NotEmpty().WithMessage("处理时间不能为空");
    }
}
