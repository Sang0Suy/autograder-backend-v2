using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using System;

namespace AutoGrader.API.Hubs
{
    [Authorize] // Bắt buộc phải có thẻ JWT mới được kết nối
    public class GradingHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            // Bóc thẻ JWT lấy UserId
            var userId = Context.User?.FindFirst("UserId")?.Value;

            if (!string.IsNullOrEmpty(userId))
            {
                // Đưa giáo viên này vào một "phòng kín" có tên là chính ID của họ
                await Groups.AddToGroupAsync(Context.ConnectionId, userId);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = Context.User?.FindFirst("UserId")?.Value;
            if (!string.IsNullOrEmpty(userId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, userId);
            }
            await base.OnDisconnectedAsync(exception);
        }
    }
}