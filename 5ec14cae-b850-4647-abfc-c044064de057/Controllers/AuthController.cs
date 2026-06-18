using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ElderlyCareSystem.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace ElderlyCareSystem.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly JwtSettings _jwtSettings;

    public AuthController(JwtSettings jwtSettings)
    {
        _jwtSettings = jwtSettings;
    }

    [HttpPost("login")]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { message = "用户名和密码不能为空" });
        }

        var users = new Dictionary<string, (string password, string role, string name, string facilityId)>
        {
            { "admin", ("admin123", "Admin", "系统管理员", "F001") },
            { "manager", ("manager123", "Manager", "运营总监", "F001") },
            { "nurse", ("nurse123", "Nurse", "张护士长", "F001") },
            { "doctor", ("doctor123", "Doctor", "李医生", "F001") },
            { "finance", ("finance123", "Finance", "王会计", "F001") },
            { "dispatcher", ("dispatch123", "Dispatcher", "赵调度员", "F001") }
        };

        if (!users.ContainsKey(request.Username) || users[request.Username].password != request.Password)
        {
            return Unauthorized(new { message = "用户名或密码错误" });
        }

        var user = users[request.Username];
        var token = GenerateJwtToken(request.Username, user.role, user.name, user.facilityId);

        return Ok(new
        {
            token,
            tokenType = "Bearer",
            expiresIn = _jwtSettings.ExpirationInMinutes * 60,
            user = new
            {
                username = request.Username,
                role = user.role,
                name = user.name,
                facilityId = user.facilityId
            }
        });
    }

    [HttpGet("current-user")]
    public IActionResult GetCurrentUser()
    {
        var claims = User.Claims.ToList();
        var username = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;
        var role = claims.FirstOrDefault(c => c.Type == ClaimTypes.Role)?.Value;
        var name = claims.FirstOrDefault(c => c.Type == "FullName")?.Value;
        var facilityId = claims.FirstOrDefault(c => c.Type == "FacilityId")?.Value;

        if (string.IsNullOrEmpty(username))
        {
            return Unauthorized();
        }

        return Ok(new
        {
            username,
            role,
            name,
            facilityId
        });
    }

    private string GenerateJwtToken(string username, string role, string fullName, string facilityId)
    {
        var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);
        var credentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim("FullName", fullName),
            new Claim("FacilityId", facilityId),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationInMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
