using System.ComponentModel.DataAnnotations;
using SpecialEquipmentInspection.Models;

namespace SpecialEquipmentInspection.Dtos;

public class CreateInspectorDto
{
    [Required(ErrorMessage = "姓名不能为空")]
    [StringLength(32)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "证书编号不能为空")]
    [StringLength(32)]
    public string CertificateNo { get; set; } = string.Empty;

    [Required(ErrorMessage = "可检验设备类型不能为空")]
    public string CertifiableTypes { get; set; } = string.Empty;

    public DateTime IssueDate { get; set; }

    public DateTime ExpiryDate { get; set; }

    [StringLength(20)]
    public string Phone { get; set; } = string.Empty;
}

public class ApproveReportDto
{
    [Required]
    [Range(1, 2, ErrorMessage = "审批操作无效")]
    public int Action { get; set; }

    [StringLength(256)]
    public string Remark { get; set; } = string.Empty;
}
