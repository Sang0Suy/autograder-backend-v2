using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Student")] // Chỉ cho phép học sinh dùng tính năng này
    public class TutorController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public TutorController(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        public class ChatMessage
        {
            public string Role { get; set; } = string.Empty; // "user" hoặc "model"
            public string Text { get; set; } = string.Empty;
        }

        public class TutorRequest
        {
            public int QuestionNumber { get; set; }
            public string StudentAnswer { get; set; } = string.Empty;
            public string AiFeedback { get; set; } = string.Empty;
            public List<ChatMessage> History { get; set; } = new List<ChatMessage>();
            public string NewMessage { get; set; } = string.Empty;
        }

        [HttpPost("ask")]
        public async Task<IActionResult> AskTutor([FromBody] TutorRequest request)
        {
            try
            {
                var apiKeys = _configuration.GetSection("GeminiAI:ApiKeys").Get<List<string>>();
                var apiUrl = _configuration["GeminiAI:Url"];
                var activeKey = apiKeys?.FirstOrDefault() ?? _configuration["GeminiAI:ApiKey"];

                // 1. Nhúng bối cảnh vào System Prompt ngầm
                string systemInstruction = $@"
                    Bạn là một gia sư AI thân thiện, kiên nhẫn và khuyến khích học sinh.
                    Học sinh đang hỏi bạn về Câu số {request.QuestionNumber} trong bài kiểm tra của họ.
                    - BÀI LÀM CỦA HỌC SINH: '{request.StudentAnswer}'
                    - ĐÁNH GIÁ CỦA HỆ THỐNG TRƯỚC ĐÓ: '{request.AiFeedback}'
                    
                    Quy tắc cốt lõi:
                    1. Xưng 'thầy/cô' hoặc 'mình', gọi học sinh là 'em' hoặc 'bạn'.
                    2. KHÔNG BAO GIỜ giải hộ hoặc đưa đáp án ngay lập tức. Hãy đặt câu hỏi gợi mở để học sinh tự nhận ra cái sai.
                    3. Giải thích ngắn gọn, dễ hiểu, dùng biểu tượng cảm xúc (emoji) thân thiện.
                    4. Trả lời bằng định dạng Markdown.";

                // 2. Định dạng Lịch sử Chat cho Gemini (Bắt buộc dùng "user" và "model")
                var contents = new List<object>();

                // Tin nhắn đầu tiên: Bơm bối cảnh (Context)
                contents.Add(new { role = "user", parts = new[] { new { text = systemInstruction } } });
                contents.Add(new { role = "model", parts = new[] { new { text = "Chào em! Thầy/cô đã nắm được bài làm của em rồi. Em có thắc mắc gì về câu này nào?" } } });

                // Nạp lịch sử trò chuyện
                foreach (var msg in request.History)
                {
                    contents.Add(new { role = msg.Role, parts = new[] { new { text = msg.Text } } });
                }

                // Nạp tin nhắn mới nhất
                contents.Add(new { role = "user", parts = new[] { new { text = request.NewMessage } } });

                var requestBody = new { contents = contents };
                var jsonContent = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                // 3. Gửi cho Gemini
                var client = _httpClientFactory.CreateClient("GeminiClient");
                var response = await client.PostAsync($"{apiUrl}{activeKey}", jsonContent);
                response.EnsureSuccessStatusCode();

                var responseString = await response.Content.ReadAsStringAsync();
                using var document = JsonDocument.Parse(responseString);

                var aiTextResponse = document.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString();

                return Ok(new { reply = aiTextResponse });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Gia sư AI đang bận: {ex.Message}" });
            }
        }
        [HttpPost("voice-to-text")]
        public async Task<IActionResult> ConvertVoiceToText(IFormFile audioFile)
        {
            if (audioFile == null || audioFile.Length == 0)
                return BadRequest("Không tìm thấy file ghi âm.");

            try
            {
                // 1. Đọc file Audio thành Base64
                using var ms = new MemoryStream();
                await audioFile.CopyToAsync(ms);
                var audioBytes = ms.ToArray();
                var base64Audio = Convert.ToBase64String(audioBytes);

                // Xác định mime type (thường trình duyệt Chrome gửi lên là audio/webm)
                var mimeType = audioFile.ContentType ?? "audio/webm";

                // 2. Chuẩn bị payload gửi cho Gemini 1.5 (Pro hoặc Flash đều hỗ trợ Audio)
                var apiKey = "YOUR_GEMINI_API_KEY"; // Thay bằng cấu hình lấy từ appsettings.json của bạn
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={apiKey}";

                var payload = new
                {
                    contents = new[]
                    {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = "Nghe đoạn ghi âm lời nhận xét của giáo viên. Hãy bóc băng và viết lại thành một đoạn văn nhận xét chuyên nghiệp, chuẩn mực sư phạm để gửi cho học sinh. Tự động sửa các lỗi diễn đạt lủng củng (nếu có). Chỉ trả về nội dung nhận xét, không thêm lời chào hay giải thích." },
                            new
                            {
                                inline_data = new
                                {
                                    mime_type = mimeType,
                                    data = base64Audio
                                }
                            }
                        }
                    }
                }
                };

                // 3. Gửi Request lên Gemini
                using var client = new HttpClient();
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, content);

                var responseString = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    return StatusCode(500, $"Lỗi từ Gemini: {responseString}");
                }

                // 4. Bóc tách Text trả về
                using var doc = JsonDocument.Parse(responseString);
                var generatedText = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString();

                return Ok(new { text = generatedText?.Trim() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }
    }
}