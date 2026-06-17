using BloodCenter.Infrastructure.Entities.Enums;

namespace BloodCenter.Infrastructure.Entities.ValueObjects;

public class BloodGroup
{
    public BloodType ABO { get; set; }
    public RhFactor Rh { get; set; }

    public override string ToString()
    {
        var rhStr = Rh == RhFactor.Positive ? "+" : "-";
        return $"{ABO}{rhStr}";
    }

    public bool IsCompatibleWith(BloodGroup recipient)
    {
        return (ABO, recipient.ABO) switch
        {
            (BloodType.O, _) => true,
            (BloodType.A, BloodType.A or BloodType.AB) => true,
            (BloodType.B, BloodType.B or BloodType.AB) => true,
            (BloodType.AB, BloodType.AB) => true,
            _ => false
        } && (Rh == RhFactor.Negative || recipient.Rh == RhFactor.Positive);
    }
}
