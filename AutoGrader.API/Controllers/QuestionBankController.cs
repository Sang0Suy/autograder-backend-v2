using AutoGrader.Application.Interfaces;
using AutoGrader.Domain;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class QuestionBankController : ControllerBase
    {
        private readonly IRepository<QuestionBankItem> _questionRepo;
        // Giả sử bạn có RubricRepo để lưu đề thi đã trộn
        private readonly IRepository<Rubric> _rubricRepo;

        public QuestionBankController(IRepository<QuestionBankItem> questionRepo, IRepository<Rubric> rubricRepo)
        {
            _questionRepo = questionRepo;
            _rubricRepo = rubricRepo;
        }

        // 1. Thêm câu hỏi mới vào ngân hàng
        [HttpPost("add")]
        public async Task<IActionResult> AddQuestion([FromBody] QuestionBankItem question)
        {
            try
            {
                await _questionRepo.CreateAsync(question);
                return Ok(new { message = "Đã thêm câu hỏi vào ngân hàng thành công!" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }

        // 2. Lấy toàn bộ câu hỏi (có thể thêm filter)
        [HttpGet("all")]
        public async Task<IActionResult> GetAllQuestions()
        {
            var questions = await _questionRepo.GetAllAsync();
            return Ok(questions);
        }

        // 3. API Siêu cấp: Tự động trộn đề thi từ Ngân hàng
        public class GenerateTestRequest
        {
            public string Title { get; set; }
            public string Subject { get; set; }
            public int EasyCount { get; set; }
            public int MediumCount { get; set; }
            public int HardCount { get; set; }
            public int NumberOfVersions { get; set; } = 1; // Số lượng mã đề cần sinh (mặc định 1)
        }

        [HttpPost("generate-test")]
        public async Task<IActionResult> GenerateTestFromBank([FromBody] GenerateTestRequest request)
        {
            try
            {
                var allQuestions = await _questionRepo.GetAllAsync();

                // Lọc câu hỏi theo môn học
                var subjectQuestions = allQuestions.Where(q => q.Subject.Equals(request.Subject, StringComparison.OrdinalIgnoreCase)).ToList();

                var easyPool = subjectQuestions.Where(q => q.DifficultyLevel == "Dễ").ToList();
                var mediumPool = subjectQuestions.Where(q => q.DifficultyLevel == "Trung Bình").ToList();
                var hardPool = subjectQuestions.Where(q => q.DifficultyLevel == "Khó").ToList();

                // Kiểm tra xem kho có đủ câu hỏi không
                if (easyPool.Count < request.EasyCount || mediumPool.Count < request.MediumCount || hardPool.Count < request.HardCount)
                {
                    return BadRequest("Ngân hàng không đủ câu hỏi theo cấu trúc bạn yêu cầu!");
                }

                var generatedTests = new List<Rubric>();
                var random = new Random();

                // Sinh ra N mã đề khác nhau
                for (int v = 0; v < request.NumberOfVersions; v++)
                {
                    // Trộn ngẫu nhiên và lấy đủ số lượng
                    var selectedEasy = easyPool.OrderBy(x => random.Next()).Take(request.EasyCount).ToList();
                    var selectedMedium = mediumPool.OrderBy(x => random.Next()).Take(request.MediumCount).ToList();
                    var selectedHard = hardPool.OrderBy(x => random.Next()).Take(request.HardCount).ToList();

                    // Gộp chung lại và trộn ngẫu nhiên thứ tự câu hỏi
                    var finalQuestions = selectedEasy.Concat(selectedMedium).Concat(selectedHard)
                                                     .OrderBy(x => random.Next())
                                                     .ToList();

                    // Chuyển đổi thành cấu trúc QuestionItem của bạn
                    var rubricQuestions = new List<QuestionItem>();
                    for (int i = 0; i < finalQuestions.Count; i++)
                    {
                        var q = finalQuestions[i];
                        rubricQuestions.Add(new QuestionItem
                        {
                            Order = i + 1, // Sửa từ QuestionNumber thành Order
                            Content = q.Content,
                            QuestionType = q.QuestionType,
                            Options = q.QuestionType == "MultipleChoice" ? string.Join("|", q.Options) : "",
                            CorrectAnswer = q.CorrectAnswer,
                            MaxScore = q.DefaultScore,
                            Difficulty = q.DifficultyLevel // Ánh xạ độ khó
                        });
                    }

                    // KHÔNG CẦN TÍNH TỔNG ĐIỂM Ở ĐÂY NỮA VÌ RUBRIC SẼ TỰ ĐỘNG TÍNH

                    // Tạo đối tượng Đề thi (Rubric) mới
                    var newRubric = new Rubric
                    {
                        Title = request.NumberOfVersions > 1 ? $"{request.Title} - Mã đề 0{v + 1}" : request.Title,
                        // BỎ DÒNG TotalScore ĐI
                        CreatedAt = DateTime.UtcNow,
                        Questions = rubricQuestions
                    };

                    await _rubricRepo.CreateAsync(newRubric);
                    generatedTests.Add(newRubric);
                }

                return Ok(new
                {
                    message = $"Đã sinh thành công {request.NumberOfVersions} mã đề thi!",
                    tests = generatedTests
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi hệ thống: {ex.Message}");
            }
        }
    }
}