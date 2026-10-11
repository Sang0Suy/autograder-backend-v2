using AutoGrader.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace AutoGrader.API.Hubs
{
    public class GradingNotificationService : IGradingNotificationService
    {
        private readonly IHubContext<GradingHub> _hubContext;

        public GradingNotificationService(IHubContext<GradingHub> hubContext)
        {
            _hubContext = hubContext;
        }

        public async Task NotifyGradingCompletedAsync(string resultId, string teacherId)
        {
            if (string.IsNullOrEmpty(teacherId)) return;

            // 🔥 Thay thế Clients.All thành Clients.Group
            // Chỉ gửi tín hiệu vào đúng "phòng" của giáo viên đó
            await _hubContext.Clients.Group(teacherId).SendAsync("ReceiveGradingUpdate", resultId);
        }
        public async Task NotifyQueueUpdateAsync(int pendingCount)
        {
            // Bắn thông báo tới TẤT CẢ mọi người đang online trên hệ thống
            await _hubContext.Clients.All.SendAsync("ReceiveQueueUpdate", pendingCount);
        }
    }
}