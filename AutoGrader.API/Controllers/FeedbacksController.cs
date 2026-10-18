using AutoGrader.Application.Interfaces;
using AutoGrader.Domain;
using AutoGrader.Domain.DTOs;
using Microsoft.AspNetCore.Mvc;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeedbacksController : ControllerBase
    {
        private readonly IRepository<Feedback> _feedbackRepository;

        public FeedbacksController(IRepository<Feedback> feedbackRepository)
        {
            _feedbackRepository = feedbackRepository;
        }

        [HttpGet("approved")]
        public async Task<IActionResult> GetApprovedFeedbacks()
        {
            var feedbacks = await _feedbackRepository.FindAsync(f => f.IsApproved);
            var latestFeedbacks = feedbacks.Reverse().Take(6).ToList();
            return Ok(latestFeedbacks);
        }

        [HttpPost]
        public async Task<IActionResult> CreateFeedback([FromBody] CreateFeedbackDto dto)
        {
            var feedback = new Feedback
            {
                CustomerName = dto.CustomerName,
                Role = dto.Role,
                Content = dto.Content,
                Rating = dto.Rating,
                IsApproved = true // Để true để khi demo gửi xong sẽ hiện ngay trên trang Home
            };

            await _feedbackRepository.CreateAsync(feedback);
            return Ok(new { message = "Cảm ơn bạn đã gửi đánh giá!" });
        }
    }
}