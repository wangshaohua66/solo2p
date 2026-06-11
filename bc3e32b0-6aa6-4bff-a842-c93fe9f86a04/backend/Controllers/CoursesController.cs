using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;
using System.Security.Claims;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CoursesController : ControllerBase
{
    private readonly ICourseService _courseService;

    public CoursesController(ICourseService courseService)
    {
        _courseService = courseService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<Course>>>> GetCourses(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? keyword = null,
        [FromQuery] CourseType? type = null,
        [FromQuery] CourseLevel? level = null,
        [FromQuery] CourseStatus? status = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = keyword };
        var result = await _courseService.GetCoursesAsync(query, type, level, status);
        return Ok(ApiResponse<PagedResult<Course>>.Success(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<Course>>> GetCourse(Guid id)
    {
        var course = await _courseService.GetCourseByIdAsync(id);
        if (course == null)
            return NotFound(ApiResponse.Fail("课程不存在", 404));

        return Ok(ApiResponse<Course>.Success(course));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<Course>>> CreateCourse([FromBody] Course course)
    {
        var result = await _courseService.CreateCourseAsync(course);
        return CreatedAtAction(nameof(GetCourse), new { id = result.Id }, ApiResponse<Course>.Success(result));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<Course>>> UpdateCourse(Guid id, [FromBody] Course course)
    {
        try
        {
            var result = await _courseService.UpdateCourseAsync(id, course);
            return Ok(ApiResponse<Course>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse>> DeleteCourse(Guid id)
    {
        try
        {
            await _courseService.DeleteCourseAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpGet("{id}/sessions")]
    public async Task<ActionResult<ApiResponse<List<CourseSession>>>> GetSessions(Guid id)
    {
        var sessions = await _courseService.GetCourseSessionsAsync(id);
        return Ok(ApiResponse<List<CourseSession>>.Success(sessions));
    }

    [HttpGet("{id}/registrations")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<List<CourseRegistration>>>> GetRegistrations(Guid id)
    {
        var registrations = await _courseService.GetCourseRegistrationsAsync(id);
        return Ok(ApiResponse<List<CourseRegistration>>.Success(registrations));
    }

    [HttpGet("{id}/my-registration")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourseRegistration>>> GetMyRegistration(Guid id)
    {
        var memberId = GetCurrentUserId();
        var registrations = await _courseService.GetCourseRegistrationsAsync(id);
        var myReg = registrations.FirstOrDefault(r => r.MemberId == memberId);
        if (myReg == null)
            return Ok(ApiResponse<CourseRegistration?>.Success(null));
        return Ok(ApiResponse<CourseRegistration>.Success(myReg));
    }

    [HttpPost("{id}/register")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<CourseRegistration>>> RegisterCourse(Guid id)
    {
        try
        {
            var memberId = GetCurrentUserId();
            var memberName = User.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;
            
            var result = await _courseService.RegisterCourseAsync(id, memberId, memberName);
            return Ok(ApiResponse<CourseRegistration>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("registrations/{registrationId}/cancel")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> CancelRegistration(Guid registrationId)
    {
        try
        {
            var memberId = GetCurrentUserId();
            await _courseService.CancelRegistrationAsync(registrationId, memberId);
            return Ok(ApiResponse.Success("取消成功"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("sessions/{sessionId}/check-in")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<AttendanceRecord>>> CheckIn(Guid sessionId)
    {
        try
        {
            var memberId = GetCurrentUserId();
            var result = await _courseService.CheckInAsync(sessionId, memberId);
            return Ok(ApiResponse<AttendanceRecord>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("sessions/{sessionId}/qrcode")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<string>>> GenerateQrCode(Guid sessionId)
    {
        var qrCode = await _courseService.GenerateQrCodeAsync(sessionId);
        return Ok(ApiResponse<string>.Success(qrCode));
    }

    [HttpGet("sessions/{sessionId}/attendance")]
    [Authorize(Roles = "Admin,Instructor")]
    public async Task<ActionResult<ApiResponse<List<AttendanceRecord>>>> GetAttendance(Guid sessionId)
    {
        var records = await _courseService.GetSessionAttendanceAsync(sessionId);
        return Ok(ApiResponse<List<AttendanceRecord>>.Success(records));
    }

    private Guid GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (idClaim == null || !Guid.TryParse(idClaim.Value, out var userId))
            throw new UnauthorizedAccessException();
        return userId;
    }
}
