using System.Security.Cryptography;
using System.Text;

namespace EvidenceManagementSystem.Common;

public static class HashHelper
{
    public static string ComputeSha256Hash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        var builder = new StringBuilder();
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }

    public static string ComputeSha256Hash(byte[] input)
    {
        var bytes = SHA256.HashData(input);
        var builder = new StringBuilder();
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }
}
