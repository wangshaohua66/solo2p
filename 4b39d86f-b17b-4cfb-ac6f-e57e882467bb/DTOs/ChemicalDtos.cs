namespace HazChemSupervision.DTOs;

public class ChemicalDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CasNo { get; set; } = string.Empty;
    public string UnNo { get; set; } = string.Empty;
    public int Category { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string MolecularFormula { get; set; } = string.Empty;
    public int HazardClass { get; set; }
    public string HazardClassName { get; set; } = string.Empty;
    public string PackingGroup { get; set; } = string.Empty;
    public string PhysicalProperties { get; set; } = string.Empty;
    public string StorageRequirements { get; set; } = string.Empty;
    public string EmergencyMeasures { get; set; } = string.Empty;
    public decimal StandardPackingWeight { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public string EnterpriseName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChemicalCreateDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CasNo { get; set; } = string.Empty;
    public string UnNo { get; set; } = string.Empty;
    public int Category { get; set; }
    public string MolecularFormula { get; set; } = string.Empty;
    public int HazardClass { get; set; }
    public string PackingGroup { get; set; } = string.Empty;
    public string PhysicalProperties { get; set; } = string.Empty;
    public string StorageRequirements { get; set; } = string.Empty;
    public string EmergencyMeasures { get; set; } = string.Empty;
    public decimal StandardPackingWeight { get; set; }
    public string Unit { get; set; } = string.Empty;
    public int EnterpriseId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ChemicalUpdateDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CasNo { get; set; } = string.Empty;
    public string UnNo { get; set; } = string.Empty;
    public int Category { get; set; }
    public string MolecularFormula { get; set; } = string.Empty;
    public int HazardClass { get; set; }
    public string PackingGroup { get; set; } = string.Empty;
    public string PhysicalProperties { get; set; } = string.Empty;
    public string StorageRequirements { get; set; } = string.Empty;
    public string EmergencyMeasures { get; set; } = string.Empty;
    public decimal StandardPackingWeight { get; set; }
    public string Unit { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class ChemicalQueryDto : PagedRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? CasNo { get; set; }
    public int? Category { get; set; }
    public int? HazardClass { get; set; }
    public int? EnterpriseId { get; set; }
    public bool? IsActive { get; set; }
}

public class EnterpriseDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string UnifiedSocialCreditCode { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string LegalPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string SafetyManager { get; set; } = string.Empty;
    public string SafetyManagerPhone { get; set; } = string.Empty;
    public int EnterpriseType { get; set; }
    public string EnterpriseTypeName { get; set; } = string.Empty;
    public int HazardLevel { get; set; }
    public bool IsActive { get; set; }
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class EnterpriseCreateDto
{
    public string Name { get; set; } = string.Empty;
    public string UnifiedSocialCreditCode { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string LegalPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string SafetyManager { get; set; } = string.Empty;
    public string SafetyManagerPhone { get; set; } = string.Empty;
    public int EnterpriseType { get; set; }
    public int HazardLevel { get; set; }
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public bool IsActive { get; set; } = true;
}

public class EnterpriseUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string UnifiedSocialCreditCode { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string LegalPerson { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string SafetyManager { get; set; } = string.Empty;
    public string SafetyManagerPhone { get; set; } = string.Empty;
    public int EnterpriseType { get; set; }
    public int HazardLevel { get; set; }
    public decimal Longitude { get; set; }
    public decimal Latitude { get; set; }
    public bool IsActive { get; set; }
}

public class EnterpriseQueryDto : PagedRequest
{
    public string? Name { get; set; }
    public string? UnifiedSocialCreditCode { get; set; }
    public int? EnterpriseType { get; set; }
    public int? HazardLevel { get; set; }
    public bool? IsActive { get; set; }
}
