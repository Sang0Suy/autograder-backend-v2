using AutoGrader.Application.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IGradingTaskQueue
    {
        ValueTask QueueBackgroundWorkItemAsync(GradingTaskPayload workItem);
        ValueTask<GradingTaskPayload> DequeueAsync(CancellationToken cancellationToken);

        // 🔥 MỚI: Thêm hàm để nhìn xuyên thấu vào hàng đợi
        int GetPendingCount();
    }
}