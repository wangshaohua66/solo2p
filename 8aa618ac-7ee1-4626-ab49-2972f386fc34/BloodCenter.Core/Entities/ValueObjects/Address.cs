namespace BloodCenter.Core.Entities.ValueObjects;

public class Address
{
    public string Street { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Province { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;

    public override string ToString()
    {
        return $"{Street}, {City}, {Province} {PostalCode}";
    }

    public override bool Equals(object? obj)
    {
        return obj is Address address &&
               Street == address.Street &&
               City == address.City &&
               Province == address.Province &&
               PostalCode == address.PostalCode;
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(Street, City, Province, PostalCode);
    }
}
