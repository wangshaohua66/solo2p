using VenueManagementSystem.Models;

namespace VenueManagementSystem.Services.Interfaces;

/// <summary>
/// 审批服务接口
/// 提供审批流程发起、审核、驳回、查询等功能
/// 实现三级审批状态机
/// </summary>
public interface IApprovalService : IServiceBase
{
    /// <summary>
    /// 异步获取活动审批步骤列表
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <returns>审批步骤列表</returns>
    Task<IEnumerable<ApprovalStep>> GetApprovalStepsAsync(int eventId);

    /// <summary>
    /// 异步批准审批步骤
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="userId">审批人ID</param>
    /// <param name="comments">审批意见</param>
    /// <returns>批准是否成功</returns>
    Task<bool> ApproveStepAsync(int eventId, int stepId, int userId, string comments);

    /// <summary>
    /// 异步驳回审批步骤
    /// </summary>
    /// <param name="eventId">活动ID</param>
    /// <param name="stepId">步骤ID</param>
    /// <param name="userId">审批人ID</param>
    /// <param name="comments">驳回原因</param>
    /// <returns>驳回是否成功</returns>
    Task<bool> RejectStepAsync(int eventId, int stepId, int userId, string comments);

    /// <summary>
    /// 异步获取待我审批的列表
    /// </summary>
    /// <param name="userId">用户ID</param>
    /// <returns>待审批列表</returns>
    Task<IEnumerable<ApprovalStep>> GetPendingApprovalsAsync(int userId);

    /// <summary>
    /// 异步检测审批超时
    /// 对超过24小时未处理的审批发送催办通知
    /// </summary>
    /// <returns>超时审批数量</returns>
    Task<int> CheckApprovalTimeoutsAsync();
}
