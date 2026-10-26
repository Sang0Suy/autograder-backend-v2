using AutoGrader.Application.Interfaces;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class ChatbotService : IChatbotService
    {
        private readonly Kernel _kernel;
        private readonly IChatCompletionService _chatCompletionService;
        private readonly ChatHistory _chatHistory;

        public ChatbotService(Kernel kernel)
        {
            _kernel = kernel;
            _chatCompletionService = _kernel.GetRequiredService<IChatCompletionService>();

            // 🔥 System Prompt: Định hình bộ não và kiến thức cho Chatbot
            _chatHistory = new ChatHistory(
                "Bạn là trợ lý AI thông minh, thân thiện của hệ thống AutoGrader - Phần mềm chấm thi tự động và quản lý giáo dục. " +
                "Nhiệm vụ của bạn là hỗ trợ giáo viên và học sinh cách sử dụng hệ thống (Ví dụ: cách tạo Barem, cách trộn đề thi tự động, cách dùng máy quét camera offline, hiểu về điểm kinh nghiệm XP). " +
                "Luôn trả lời ngắn gọn, súc tích, chuyên nghiệp và sử dụng emoji cho thân thiện. Không bịa đặt tính năng nếu hệ thống không có."
            );
        }

        public async Task<string> AskAssistantAsync(string userMessage)
        {
            // 1. Thêm câu hỏi của User vào bối cảnh
            _chatHistory.AddUserMessage(userMessage);

            // 2. Gửi toàn bộ lịch sử cho Gemini xử lý
            var response = await _chatCompletionService.GetChatMessageContentAsync(
                _chatHistory,
                kernel: _kernel
            );

            // 3. Lưu câu trả lời của AI vào bộ nhớ để hiểu ngữ cảnh cho câu sau
            _chatHistory.AddAssistantMessage(response.Content);

            return response.Content;
        }
    }
}