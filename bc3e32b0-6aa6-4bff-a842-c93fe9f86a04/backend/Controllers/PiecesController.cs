using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PotteryStudio.Models;
using PotteryStudio.Services;

namespace PotteryStudio.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PiecesController : ControllerBase
{
    private readonly IPieceService _pieceService;

    public PiecesController(IPieceService pieceService)
    {
        _pieceService = pieceService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResult<PieceArchive>>>> GetPieces(
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? memberId = null,
        [FromQuery] PieceStatus? status = null,
        [FromQuery] PhotoStage? stage = null)
    {
        var query = new PagedQuery { PageIndex = pageIndex, PageSize = pageSize, Keyword = search };
        var result = await _pieceService.GetPiecesAsync(query, memberId, status, stage, search);
        return Ok(ApiResponse<PagedResult<PieceArchive>>.Success(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<PieceArchive>>> GetPiece(Guid id)
    {
        var piece = await _pieceService.GetPieceByIdAsync(id);
        if (piece == null)
            return NotFound(ApiResponse.Fail("作品不存在", 404));

        return Ok(ApiResponse<PieceArchive>.Success(piece));
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PieceArchive>>> CreatePiece([FromBody] PieceArchive piece)
    {
        var result = await _pieceService.CreatePieceAsync(piece);
        return CreatedAtAction(nameof(GetPiece), new { id = result.Id }, ApiResponse<PieceArchive>.Success(result));
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PieceArchive>>> UpdatePiece(Guid id, [FromBody] PieceArchive piece)
    {
        try
        {
            var result = await _pieceService.UpdatePieceAsync(id, piece);
            return Ok(ApiResponse<PieceArchive>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("{id}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> DeletePiece(Guid id)
    {
        try
        {
            await _pieceService.DeletePieceAsync(id);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpGet("{id}/photos")]
    public async Task<ActionResult<ApiResponse<List<PiecePhoto>>>> GetPhotos(Guid id)
    {
        var photos = await _pieceService.GetPiecePhotosAsync(id);
        return Ok(ApiResponse<List<PiecePhoto>>.Success(photos));
    }

    [HttpPost("{id}/photos")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PiecePhoto>>> AddPhoto(Guid id, [FromBody] PiecePhoto photo)
    {
        try
        {
            var result = await _pieceService.AddPhotoAsync(id, photo);
            return Ok(ApiResponse<PiecePhoto>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPut("photos/{photoId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PiecePhoto>>> UpdatePhoto(Guid photoId, [FromBody] PiecePhoto photo)
    {
        try
        {
            var result = await _pieceService.UpdatePhotoAsync(photoId, photo);
            return Ok(ApiResponse<PiecePhoto>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpDelete("photos/{photoId}")]
    [Authorize]
    public async Task<ActionResult<ApiResponse>> DeletePhoto(Guid photoId)
    {
        try
        {
            await _pieceService.DeletePhotoAsync(photoId);
            return Ok(ApiResponse.Success("删除成功"));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }

    [HttpPost("{id}/status")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PieceArchive>>> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        try
        {
            var result = await _pieceService.UpdateStatusAsync(id, request.Status);
            return Ok(ApiResponse<PieceArchive>.Success(result));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ApiResponse.Fail(ex.Message, 404));
        }
    }
}

public class UpdateStatusRequest
{
    public PieceStatus Status { get; set; }
}
