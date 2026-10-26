using AutoGrader.Domain.DTOs;
using AutoGrader.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ChatbotController : ControllerBase
    {
        private readonly IChatbotService _chatbotService;

        public ChatbotController(IChatbotService chatbotService)
        {
            _chatbotService = chatbotService;
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] ChatRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("Câu hỏi không được để trống.");
            }

            try
            {
                var reply = await _chatbotService.AskAssistantAsync(request.Message);

                // Trả về JSON khớp chuẩn với response.data.reply ở React Frontend
                return Ok(new ChatResponseDto { Reply = reply });
            }
            catch (Exception ex)
            {
                // Ghi log lỗi tại đây
                return StatusCode(500, new { error = "Hệ thống AI đang bận, vui lòng thử lại sau.", details = ex.Message });
            }
        }
    }
}