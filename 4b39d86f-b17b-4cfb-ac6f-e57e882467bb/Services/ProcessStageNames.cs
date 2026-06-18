using HazChemSupervision.Models;

namespace HazChemSupervision.Services;

public static class ProcessStageNames
{
    private static readonly Dictionary<ProcessStage, string> StageNameMap = new()
    {
        { ProcessStage.BatchCreated, "批次创建" },
        { ProcessStage.RawMaterialInbound, "原料入库" },
        { ProcessStage.ProductionProcessing, "生产加工" },
        { ProcessStage.FinishedInspection, "成品检验" },
        { ProcessStage.InStorage, "成品入库" },
        { ProcessStage.OutboundReview, "出库复核" },
        { ProcessStage.InTransit, "运输在途" },
        { ProcessStage.Delivered, "送达确认" }
    };

    private static readonly Dictionary<ProcessStatus, string> StatusNameMap = new()
    {
        { ProcessStatus.Pending, "待开始" },
        { ProcessStatus.InProgress, "进行中" },
        { ProcessStatus.Completed, "已完成" },
        { ProcessStatus.Failed, "失败" },
        { ProcessStatus.Cancelled, "已取消" }
    };

    private static readonly Dictionary<BatchStatus, ProcessStage> BatchStatusToStageMap = new()
    {
        { BatchStatus.RawMaterial, ProcessStage.BatchCreated },
        { BatchStatus.InProduction, ProcessStage.RawMaterialInbound },
        { BatchStatus.Inspecting, ProcessStage.ProductionProcessing },
        { BatchStatus.Qualified, ProcessStage.FinishedInspection },
        { BatchStatus.Unqualified, ProcessStage.FinishedInspection },
        { BatchStatus.InStorage, ProcessStage.InStorage },
        { BatchStatus.OutForDelivery, ProcessStage.OutboundReview },
        { BatchStatus.Delivered, ProcessStage.Delivered }
    };

    public static string GetStageName(ProcessStage stage)
        => StageNameMap.TryGetValue(stage, out var name) ? name : stage.ToString();

    public static string GetStatusName(ProcessStatus status)
        => StatusNameMap.TryGetValue(status, out var name) ? name : status.ToString();

    public static string GetStageName(int stage)
        => GetStageName((ProcessStage)stage);

    public static ProcessStage GetStageFromBatchStatus(BatchStatus batchStatus)
        => BatchStatusToStageMap.TryGetValue(batchStatus, out var stage) ? stage : ProcessStage.BatchCreated;
}

public static class TransportStatusNames
{
    private static readonly Dictionary<TransportStatus, string> StatusNameMap = new()
    {
        { TransportStatus.Pending, "待发运" },
        { TransportStatus.Loading, "装车中" },
        { TransportStatus.InTransit, "运输在途" },
        { TransportStatus.Deviating, "路线偏离" },
        { TransportStatus.Delivered, "已送达" },
        { TransportStatus.Completed, "已完成" },
        { TransportStatus.Cancelled, "已取消" }
    };

    public static string GetStatusName(TransportStatus status)
        => StatusNameMap.TryGetValue(status, out var name) ? name : status.ToString();

    public static string GetStatusName(int status)
        => GetStatusName((TransportStatus)status);
}
