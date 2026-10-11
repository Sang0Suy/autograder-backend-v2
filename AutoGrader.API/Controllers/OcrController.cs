using AutoGrader.Application.Interfaces;
using AutoGrader.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OcrController : ControllerBase
    {
        private readonly IOcrService _ocrService;

        // 🔥 Khai báo Factory và Danh sách Key
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly List<string> _apiKeys;
        private readonly string _apiUrl;
        private readonly IFileExtractionService _fileExtractionService;
        private readonly IAIGradingService _aiGradingService;

        public OcrController(IOcrService ocrService, IHttpClientFactory httpClientFactory, IConfiguration configuration, IFileExtractionService fileExtractionService, IAIGradingService aiGradingService)
        {
            _ocrService = ocrService;

            // Cấu hình AI: Dùng Factory và lấy mảng ApiKeys
            _httpClientFactory = httpClientFactory;
            _apiKeys = configuration.GetSection("GeminiAI:ApiKeys").Get<List<string>>() ?? new List<string>();
            _apiUrl = configuration["GeminiAI:Url"];
            _fileExtractionService = fileExtractionService;
            _aiGradingService = aiGradingService;
        }

        [HttpPost("extract-text")]
        public async Task<IActionResult> ExtractText(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("Vui lòng tải lên một tệp ảnh.");
            }

            try
            {
                using var stream = file.OpenReadStream();
                var extractedText = await _ocrService.ExtractTextFromImageAsync(stream);
                return Ok(new { text = extractedText });
            }
            catch (System.Exception ex)
            {
                return StatusCode(500, $"Lỗi OCR: {ex.Message}");
            }
        }

        [HttpPost("extract-exam")]
        public async Task<IActionResult> ExtractExam(IFormFile file, IFormFile ImageFiles)
        {
            // Bắt đúng file gửi từ React (Dù React gửi tên biến là 'file' hay 'ImageFiles')
            var targetFile = file ?? ImageFiles;
            if (targetFile == null || targetFile.Length == 0) return BadRequest("Không tìm thấy file.");

            try
            {
                // BƯỚC 1: Dùng FileExtractionService đọc mọi loại file (PDF, Word, Ảnh) thành TEXT THÔ
                string rawText = await _fileExtractionService.ExtractTextAsync(targetFile);

                if (string.IsNullOrWhiteSpace(rawText) || rawText == "Bỏ trống")
                    return BadRequest("Không thể đọc được chữ từ file này.");

                // BƯỚC 2: Đẩy Text thô vào Gemini để nó tự động cấu trúc hóa thành JSON Barem
                string jsonRubric = await _aiGradingService.ExtractRubricFromTextAsync(rawText);

                // BƯỚC 3: Trả về thẳng cho React để hiển thị lên form
                return Content(jsonRubric, "application/json");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // 🔥 API 2: ĐỌC ĐÁP ÁN TỪ MỌI ĐỊNH DẠNG (Barem)
        [HttpPost("extract-answer-key")]
        public async Task<IActionResult> ExtractAnswerKey(IFormFile file, IFormFile ImageFiles)
        {
            var targetFile = file ?? ImageFiles;
            if (targetFile == null || targetFile.Length == 0) return BadRequest("Không tìm thấy file.");

            try
            {
                // BƯỚC 1: Đọc Text từ mọi định dạng (Word, Excel, PDF, Ảnh...)
                string rawText = await _fileExtractionService.ExtractTextAsync(targetFile);

                if (string.IsNullOrWhiteSpace(rawText) || rawText == "Bỏ trống")
                    return BadRequest("Không thể đọc được chữ từ file này.");

                // BƯỚC 2: Yêu cầu AI bóc tách Text đó thành JSON Barem
                var prompt = $@"
                    Bạn là AI bóc tách Barem/Đáp án từ văn bản thô. 
                    Nhiệm vụ: Chỉ tìm và trích xuất danh sách đáp án đúng hoặc hướng dẫn chấm từ nội dung sau.
                    
                    ==== NỘI DUNG VĂN BẢN ====
                    {rawText}

                    ==== YÊU CẦU ĐẦU RA (CHỈ JSON, KHÔNG MARKDOWN) ====
                    {{
                      ""answers"": [
                        {{
                          ""order"": 1,
                          ""correctAnswer"": ""A"", 
                          ""explanation"": ""(Hướng dẫn chấm hoặc giải thích nếu có)""
                        }}
                      ]
                    }}";

                var requestBody = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
                var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

                var client = _httpClientFactory.CreateClient("GeminiClient");
                var activeKey = _apiKeys[new Random().Next(_apiKeys.Count)];
                var response = await client.PostAsync($"{_apiUrl}{activeKey}", content);

                if (!response.IsSuccessStatusCode) return StatusCode(500, await response.Content.ReadAsStringAsync());

                var responseString = await response.Content.ReadAsStringAsync();
                using var document = JsonDocument.Parse(responseString);
                var aiTextResponse = document.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();

                // Lọc bỏ markdown
                var cleanJson = aiTextResponse?.Replace("```json", "").Replace("```", "").Trim() ?? "{}";

                return Content(cleanJson, "application/json");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"Lỗi xử lý đáp án: {ex.Message}" });
            }
        }
    }
}