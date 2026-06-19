using Microsoft.AspNetCore.Mvc;
using MiningGovApi.Models;

namespace MiningGovApi.Controllers;

public abstract class BaseController : ControllerBase
{
    protected IActionResult Success<T>(T data, string message = "操作成功")
    {
        return Ok(new ApiResponse<T>
        {
            Code = 200,
            Message = message,
            Data = data
        });
    }

    protected IActionResult Success(string message = "操作成功")
    {
        return Ok(new ApiResponse
        {
            Code = 200,
            Message = message
        });
    }

    protected IActionResult BadRequestResult(string message)
    {
        return BadRequest(new ApiResponse
        {
            Code = 400,
            Message = message
        });
    }
}
