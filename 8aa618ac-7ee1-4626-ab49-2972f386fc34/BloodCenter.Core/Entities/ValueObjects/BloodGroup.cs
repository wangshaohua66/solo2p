using BloodCenter.Core.Entities.Enums;

namespace BloodCenter.Core.Entities.ValueObjects;

public class BloodGroup
{
    public BloodType ABO { get; set; }
    public RhFactor Rh { get; set; }

    public bool IsCompatibleWith(BloodGroup recipient)
    {
        bool aboCompatible = (ABO, recipient.ABO) switch
        {
            (BloodType.O, _) => true,
            (BloodType.A, BloodType.A or BloodType.AB) => true,
            (BloodType.B, BloodType.B or BloodType.AB) => true,
            (BloodType.AB, BloodType.AB) => true,
            _ => false
        };

        bool rhCompatible = Rh == RhFactor.Negative || recipient.Rh == RhFactor.Positive;

        return aboCompatible && rhCompatible;
    }

    public override string ToString()
    {
        return $"{ABO}{(Rh == RhFactor.Positive ? "+" : "-")}";
    }

    public override bool Equals(object? obj)
    {
        return obj is BloodGroup group && ABO == group.ABO && Rh == group.Rh;
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(ABO, Rh);
    }
}
