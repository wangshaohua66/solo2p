using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;
using CampHub.Models;
using CampHub.Services;

namespace CampHub.Controllers;

[Route("api/[controller]/[action]")]
[ApiController]
[Produces("application/json")]
public class AccountController : ControllerBase
{
    private readonly MongoContext _db;
    private readonly JwtService _jwt;

    public AccountController(MongoContext db, JwtService jwt)
    {
        _db = db;
        _jwt = jwt;
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Login([FromBody] LoginRequestDto req)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse<AuthResponseDto>.Fail("参数校验失败"));

        var user = await _db.Users
            .Find(u => u.Email == req.Email.ToLowerInvariant().Trim())
            .FirstOrDefaultAsync();

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            return Unauthorized(ApiResponse<AuthResponseDto>.Fail("邮箱或密码错误"));
        }

        var auth = await _jwt.GenerateAuthResponse(user);
        AppendAuthCookies(auth);
        return Ok(ApiResponse<AuthResponseDto>.Ok(auth, "登录成功"));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Register([FromBody] RegisterRequestDto req)
    {
        if (!ModelState.IsValid)
        {
            var errors = string.Join("; ", ModelState.Values
                .SelectMany(v => v.Errors).Select(e => e.ErrorMessage));
            return BadRequest(ApiResponse<AuthResponseDto>.Fail(errors));
        }

        var normalizedEmail = req.Email.ToLowerInvariant().Trim();
        var exists = await _db.Users
            .Find(u => u.Email == normalizedEmail)
            .AnyAsync();
        if (exists)
        {
            return Conflict(ApiResponse<AuthResponseDto>.Fail("该邮箱已注册"));
        }

        var user = new User
        {
            Email = normalizedEmail,
            Nickname = req.Nickname.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password, workFactor: 11),
            AvatarUrl = string.Empty,
            CreditScore = 100,
            CreatedAt = DateTime.UtcNow
        };

        await _db.Users.InsertOneAsync(user);

        var auth = await _jwt.GenerateAuthResponse(user);
        AppendAuthCookies(auth);
        return Ok(ApiResponse<AuthResponseDto>.Ok(auth, "注册成功"));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<AuthResponseDto>>> Refresh([FromBody] RefreshTokenRequestDto req)
    {
        var rt = string.IsNullOrEmpty(req.RefreshToken)
            ? Request.Cookies["refresh_token"]
            : req.RefreshToken;

        if (string.IsNullOrEmpty(rt))
            return Unauthorized(ApiResponse<AuthResponseDto>.Fail("缺少刷新令牌"));

        var auth = await _jwt.RefreshAccessToken(rt);
        if (auth == null)
            return Unauthorized(ApiResponse<AuthResponseDto>.Fail("刷新令牌已过期或已注销"));

        AppendAuthCookies(auth);
        return Ok(ApiResponse<AuthResponseDto>.Ok(auth));
    }

    [HttpPost]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<ApiResponse>> Logout()
    {
        var userId = JwtService.GetUserIdFromClaims(User);
        if (!string.IsNullOrEmpty(userId))
        {
            await _jwt.RevokeRefreshToken(userId);
        }

        Response.Cookies.Delete("access_token");
        Response.Cookies.Delete("refresh_token");
        return Ok(ApiResponse.Ok("已退出登录"));
    }

    [HttpGet]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<ActionResult<ApiResponse<UserDto>>> Me()
    {
        var userId = JwtService.GetUserIdFromClaims(User);
        if (string.IsNullOrEmpty(userId))
            return Unauthorized(ApiResponse<UserDto>.Fail("未登录"));

        var user = await _db.Users.Find(u => u.Id == userId).FirstOrDefaultAsync();
        if (user == null) return NotFound(ApiResponse<UserDto>.Fail("用户不存在"));

        return Ok(ApiResponse<UserDto>.Ok(JwtService.MapToUserDto(user)));
    }

    private void AppendAuthCookies(AuthResponseDto auth)
    {
        var cookieOpts = new CookieOptions
        {
            HttpOnly = true,
            Secure = false,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(120)
        };
        Response.Cookies.Append("access_token", auth.AccessToken, cookieOpts);
        Response.Cookies.Append("refresh_token", auth.RefreshToken,
            new CookieOptions
            {
                HttpOnly = true,
                Secure = false,
                SameSite = SameSiteMode.Lax,
                Expires = DateTimeOffset.UtcNow.AddDays(7)
            });
    }
}

[Route("[controller]")]
public class AccountMvcController : Controller
{
    public IActionResult Login(string returnUrl = "/")
    {
        if (User.Identity?.IsAuthenticated == true) return Redirect(returnUrl);
        ViewData["ReturnUrl"] = returnUrl;
        return View("~/Views/Account/Login.cshtml");
    }

    public IActionResult Register(string returnUrl = "/")
    {
        if (User.Identity?.IsAuthenticated == true) return Redirect(returnUrl);
        ViewData["ReturnUrl"] = returnUrl;
        return View("~/Views/Account/Register.cshtml");
    }
}
