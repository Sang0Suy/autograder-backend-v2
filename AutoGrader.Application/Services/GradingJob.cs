using System.Threading.Tasks;
using AutoGrader.Application.Interfaces;

namespace AutoGrader.Application.Services
{
    public class GradingJob
    {
        private readonly IExpoNotificationService _notificationService;

        public GradingJob(IExpoNotificationService notificationService)
        {
            _notificationService = notificationService;
        }

        // Đã thêm tham số 'double score' vào cuối
        public async Task ProcessGradingAsync(string token, string studentName, double score)
        {
            // Chờ 5 giây giả lập
            await Task.Delay(5000);

            string title = "AutoGrader: Có kết quả mới! 📝";

            // Gắn trực tiếp biến score vào thông báo
            string body = $"Hệ thống đã chấm xong bài của {studentName}. Điểm: {score}/10. Chúc mừng bạn!";

            await _notificationService.SendPushNotificationAsync(token, title, body);
        }
    }
}