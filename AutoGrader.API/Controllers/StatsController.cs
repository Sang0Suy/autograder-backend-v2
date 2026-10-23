using AutoGrader.Application.Interfaces;
using AutoGrader.Domain;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly IRepository<SystemStat> _statRepository;
        private readonly IRepository<StudentResult> _resultRepo;

        public StatsController(IRepository<SystemStat> statRepository, IRepository<StudentResult> resultRepo)
        {
            _statRepository = statRepository;
            _resultRepo = resultRepo;
        }

        [HttpGet("visit")]
        public async Task<IActionResult> IncrementAndGetVisits()
        {
            var stats = await _statRepository.GetAllAsync();
            var stat = stats.FirstOrDefault();

            if (stat == null)
            {
                stat = new SystemStat { TotalVisits = 12458 };
                await _statRepository.CreateAsync(stat);
            }
            else
            {
                stat.TotalVisits++;
                await _statRepository.UpdateAsync(stat.Id!, stat);
            }

            return Ok(new { totalVisits = stat.TotalVisits });
        }
        [HttpGet("item-analysis/{testId}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> GetItemAnalysis(string testId)
        {
            try
            {
                // Lấy tất cả bài thi của testId này
                var allResults = await _resultRepo.GetAllAsync();
                var testResults = allResults.Where(r => r.TestId == testId && r.TotalScore > 0).ToList();

                if (!testResults.Any()) return Ok(new List<object>());

                // Dictionary lưu số lượt trả lời đúng của từng câu: { QuestionNumber: CorrectCount }
                var correctCounts = new Dictionary<int, int>();
                var totalAttempts = testResults.Count;

                foreach (var result in testResults)
                {
                    if (result.GradingDetails == null) continue;

                    foreach (var detail in result.GradingDetails)
                    {
                        var qNum = detail.QuestionNumber;
                        var isCorrect = detail.FinalScore > 0 || detail.AwardedScore > 0;

                        if (!correctCounts.ContainsKey(qNum))
                        {
                            correctCounts[qNum] = 0;
                        }

                        if (isCorrect)
                        {
                            correctCounts[qNum]++;
                        }
                    }
                }

                // Chuyển đổi thành List trả về cho Frontend vẽ biểu đồ
                var analysisData = correctCounts.Select(kv => new
                {
                    QuestionNumber = kv.Key,
                    CorrectRate = Math.Round(((double)kv.Value / totalAttempts) * 100, 1),
                    IncorrectRate = Math.Round(100 - (((double)kv.Value / totalAttempts) * 100), 1)
                }).OrderBy(x => x.QuestionNumber).ToList();

                return Ok(analysisData);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi phân tích câu hỏi: {ex.Message}");
            }
        }
    }
}