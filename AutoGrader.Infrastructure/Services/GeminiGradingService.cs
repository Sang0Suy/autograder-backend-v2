using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;

namespace AutoGrader.Infrastructure.Services
{
    public class GeminiGradingService : IAIGradingService
    {
        private readonly List<string> _apiKeys;
        private readonly string _apiUrl;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IRepository<CorrectionRule> _ruleRepository;

        private static int _currentKeyIndex = 0;
        private static readonly object _lock = new object();

        public GeminiGradingService(
            IConfiguration configuration,
            IHttpClientFactory httpClientFactory,
            IRepository<CorrectionRule> ruleRepository)
        {
            _apiKeys = configuration.GetSection("GeminiAI:ApiKeys").Get<List<string>>() ?? new List<string>();

            if (_apiKeys.Count == 0)
            {
                var oldKey = configuration["GeminiAI:ApiKey"];
                if (!string.IsNullOrEmpty(oldKey)) _apiKeys.Add(oldKey);
            }

            _apiUrl = configuration["GeminiAI:Url"] ?? string.Empty;
            _httpClientFactory = httpClientFactory;
            _ruleRepository = ruleRepository;
        }

        private string GetNextApiKey()
        {
            if (_apiKeys.Count == 0) throw new Exception("Chưa cấu hình API Key cho Gemini.");

            lock (_lock)
            {
                var key = _apiKeys[_currentKeyIndex];
                _currentKeyIndex = (_currentKeyIndex + 1) % _apiKeys.Count;
                return key;
            }
        }

        private async Task<string> ExecuteWithKeyRotationAsync(object requestBody, CancellationToken cancellationToken)
        {
            var client = _httpClientFactory.CreateClient("GeminiClient");
            string requestJson = JsonSerializer.Serialize(requestBody);
            int maxTries = _apiKeys.Count * 2;

            for (int i = 0; i < maxTries; i++)
            {
                var activeKey = GetNextApiKey();
                var requestMessage = new HttpRequestMessage(HttpMethod.Post, $"{_apiUrl}{activeKey}")
                {
                    Content = new StringContent(requestJson, Encoding.UTF8, "application/json")
                };

                var response = await client.SendAsync(requestMessage, cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync();
                }

                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.WriteLine($"[Smart Key Pool] Key hiện tại đang bị 429. Đang chuyển sang thẻ bài khác... (Lần thử {i + 1}/{maxTries})");
                    Console.ResetColor();

                    await Task.Delay(1500, cancellationToken);
                    continue;
                }

                response.EnsureSuccessStatusCode();
            }

            throw new Exception("Toàn bộ API Keys đều đã kiệt sức vì quá tải. Vui lòng đợi 1 lát rồi thử lại!");
        }

        public async Task<AIGradingResult> GradeAnswerAsync(string studentAnswer, string rubricContext, CancellationToken cancellationToken = default)
        {
            var dynamicTrainingPrompt = new StringBuilder();
            try
            {
                var customRules = await _ruleRepository.GetAllAsync();
                if (customRules != null && customRules.Any())
                {
                    foreach (var rule in customRules)
                    {
                        dynamicTrainingPrompt.AppendLine($"- Tình huống [{rule.TargetScenario}]: \"{rule.UserRule}\"");
                    }
                }
                else
                {
                    dynamicTrainingPrompt.AppendLine("- Không có luật bổ sung nào từ giáo viên.");
                }
            }
            catch (Exception)
            {
                dynamicTrainingPrompt.AppendLine("- Không thể nạp luật bổ sung từ hệ thống cơ sở dữ liệu.");
            }

            var prompt = $@"
                Bạn là một giáo viên chấm thi tự động cực kỳ nghiêm khắc, công tâm nhưng cũng rất thực tế.
                Nhiệm vụ của bạn là chấm điểm bài làm của học sinh (được trích xuất dạng văn bản) dựa trên Barem đáp án (JSON).

                ==== VÍ DỤ VỀ GU CHẤM BÀI MẪU ====
                - Bài làm: ""Bỏ trống"" -> Lời phê: ""Chấm điểm cho tờ giấy trắng? Học sinh không làm bài, 0 điểm.""
                - Bài làm: ""aaaaaa bbbbb cccc"" -> Lời phê: ""Chấm điểm theo số lượng chữ à? Toàn ký tự rác, 0 điểm, phạt cọ toilet.""

                ==== QUY TẮC HUẤN LUYỆN BỔ SUNG TỪ GIÁO VIÊN ====
                {dynamicTrainingPrompt.ToString()}

                ==== THÔNG TIN ĐỀ THI VÀ ĐÁP ÁN (BAREM) ====
                {rubricContext}

                ==== NỘI DUNG BÀI LÀM CỦA HỌC SINH VỪA TRÍCH XUẤT ====
                {studentAnswer}

                ==== QUY TẮC CHẤM ĐIỂM & CHỐNG SPAM ====
                1. ĐÁNH GIÁ ĐỘC LẬP TỪNG CÂU.
                2. CHỐNG COPY-PASTE: Không lấy 1 đáp án gán cho nhiều câu.
                3. XỬ LÝ CÂU BỎ TRỐNG: Cho 0 điểm ngay lập tức.
                4. CHỐNG SPAM LỜI PHÊ: Đa dạng hóa lời phê.
                5. CHẤM TRẮC NGHIỆM: Phải đúng hoàn toàn mới có điểm.
                6. ĐỘ BAO DUNG VỚI LỖI OCR: Bỏ qua các lỗi chính tả vô lý do máy quét (vd mất dấu, nhầm 'l' thành 'I'). Chấm theo ý nghĩa.

                ==== YÊU CẦU ĐẦU RA BẮT BUỘC ====
                CHỈ ĐƯỢC PHÉP trả về kết quả dưới dạng chuỗi JSON nguyên gốc, KHÔNG bọc trong markdown:
                {{
                    ""StudentCode"": ""Mã học sinh"",
                    ""StudentName"": ""Họ tên"",
                    ""TotalScore"": 10.0,
                    ""OverallFeedback"": ""Nhận xét tổng quan..."",
                    ""Details"": [
                        {{
                            ""QuestionNumber"": 1,
                            ""AwardedScore"": 1.0,
                            ""RecognizedText"": ""Học sinh trả lời..."",
                            ""AIFeedback"": ""Nhận xét...""
                        }}
                    ]
                }}";

            var requestBody = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };

            try
            {
                string responseString = await ExecuteWithKeyRotationAsync(requestBody, cancellationToken);

                using var document = JsonDocument.Parse(responseString);
                // 🔥 An toàn chống Null
                var aiTextResponse = document.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? string.Empty;

                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var match = Regex.Match(aiTextResponse, @"\{.*\}", RegexOptions.Singleline);

                if (match.Success)
                {
                    string cleanJson = match.Value;
                    var gradingResult = JsonSerializer.Deserialize<AIGradingResult>(cleanJson, options);

                    if (gradingResult != null)
                    {
                        gradingResult.TotalScore = Math.Round(gradingResult.TotalScore, 2);

                        if (gradingResult.Details != null)
                        {
                            foreach (var detail in gradingResult.Details)
                            {
                                detail.AwardedScore = Math.Round(detail.AwardedScore, 2);
                            }
                        }
                        return gradingResult;
                    }
                }

                throw new Exception("Mô hình AI không trả về cấu trúc dữ liệu định dạng JSON hợp lệ.");
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex)
            {
                throw new Exception($"Không thể kết nối hoặc xử lý dữ liệu từ hệ thống AI: {ex.Message}");
            }
        }

        public async Task<string> ExtractRubricFromTextAsync(string rawText, CancellationToken cancellationToken = default)
        {
            var prompt = $@"
                Bạn là một chuyên gia phân tích dữ liệu giáo dục. Nhiệm vụ của bạn là đọc đoạn văn bản thô sau và bóc tách thành JSON:

                ==== NỘI DUNG VĂN BẢN ====
                {rawText}

                ==== YÊU CẦU BÓC TÁCH ====
                1. Tìm tiêu đề.
                2. Tách từng câu hỏi (MultipleChoice / Essay).
                3. ĐỊNH DẠNG ĐÁP ÁN TRẮC NGHIỆM: 'options' phải là chuỗi có ĐÚNG 4 đáp án ngăn bởi dấu '|'. Ví dụ: ""A|B|C|D"". KHÔNG trả về mảng.
                4. Tìm đáp án đúng (correctAnswer).
                5. maxScore mặc định là 1.0.

                ==== ĐỊNH DẠNG ĐẦU RA JSON ====
                {{
                    ""title"": ""Tên đề"",
                    ""questions"": [
                        {{
                            ""questionType"": ""MultipleChoice"",
                            ""content"": ""Câu hỏi..."",
                            ""options"": ""A|B|C|D"",
                            ""correctAnswer"": ""A"",
                            ""explanation"": """",
                            ""maxScore"": 1.0
                        }}
                    ]
                }}";

            var requestBody = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };

            try
            {
                string responseString = await ExecuteWithKeyRotationAsync(requestBody, cancellationToken);

                using var document = JsonDocument.Parse(responseString);
                // 🔥 An toàn chống Null
                var aiTextResponse = document.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? string.Empty;

                var match = Regex.Match(aiTextResponse, @"\{.*\}", RegexOptions.Singleline);
                if (match.Success)
                {
                    return match.Value;
                }

                return aiTextResponse.Replace("```json", "").Replace("```", "").Trim();
            }
            catch (Exception ex)
            {
                throw new Exception($"Lỗi khi bóc tách đề thi bằng AI: {ex.Message}");
            }
        }
    }
}