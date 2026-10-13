using Microsoft.AspNetCore.Mvc;
using Hangfire;
using AutoGrader.Application.Services; // Nhớ using đúng namespace chứa GradingJob

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationController : ControllerBase
    {
        private readonly IBackgroundJobClient _backgroundJobClient;

        // Tiêm IBackgroundJobClient của Hangfire vào Controller
        public NotificationController(IBackgroundJobClient backgroundJobClient)
        {
            _backgroundJobClient = backgroundJobClient;
        }

        [HttpPost("submit-test")]
        public IActionResult SubmitTest([FromBody] SubmitRequest request)
        {
            if (string.IsNullOrEmpty(request.Token)) return BadRequest("Thiếu Token!");

            // 1. Ném tác vụ chấm bài vào chạy ngầm. Trả về ngay lập tức không chờ đợi.
            _backgroundJobClient.Enqueue<GradingJob>(job => job.ProcessGradingAsync(request.Token, request.StudentName, request.Score));
            // 2. API phản hồi ngay lập tức cho điện thoại/Frontend
            return Ok(new { message = "Đã nhận bài thi. Quá trình chấm đang chạy ngầm, bạn có thể thoát App!" });
        }
    }

    public class SubmitRequest
    {
        public string Token { get; set; }
        public string StudentName { get; set; }
        public double Score { get; set; } // 🔥 THÊM: Biến điểm số
    }
}