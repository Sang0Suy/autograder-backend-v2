using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    // Bản hợp đồng định nghĩa việc gửi thông báo, không quan tâm bên dưới dùng SignalR hay gì khác
    public interface IGradingNotificationService
    {
        Task NotifyGradingCompletedAsync(string resultId, string teacherId);
        // Thêm hàm thông báo cập nhật hàng đợi chung cho toàn Server
        Task NotifyQueueUpdateAsync(int pendingCount);
    }
}