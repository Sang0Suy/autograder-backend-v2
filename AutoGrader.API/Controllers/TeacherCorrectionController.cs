using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using AutoGrader.Application.DTOs; // Import DTO của bạn

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TeacherCorrectionController : ControllerBase
    {
        private readonly IRepository<StudentResult> _resultRepo;

        public TeacherCorrectionController(IRepository<StudentResult> resultRepo)
        {
            _resultRepo = resultRepo;
        }

        // API này nhận yêu cầu sửa điểm từ Giáo viên
        [HttpPost("apply-correction")]
        public async Task<IActionResult> ApplyCorrection([FromBody] TeacherCorrectionDto correctionDto)
        {
            // Kiểm tra theo đúng biến ResultId của bạn
            if (correctionDto == null || string.IsNullOrEmpty(correctionDto.ResultId))
                return BadRequest("Dữ liệu không hợp lệ.");

            // 1. Tìm bài làm của học sinh
            var result = await _resultRepo.GetByIdAsync(correctionDto.ResultId);
            if (result == null) return NotFound("Không tìm thấy kết quả bài thi.");

            // 2. Tìm câu hỏi mà giáo viên muốn sửa trong danh sách GradingDetails
            var detailToUpdate = result.GradingDetails.FirstOrDefault(d => d.QuestionNumber == correctionDto.QuestionNumber);

            if (detailToUpdate != null)
            {
                // 3. Ghi nhận sự sửa đổi bằng các biến từ DTO mới
                detailToUpdate.FinalScore = correctionDto.NewScore;

                // Mẹo nhỏ: Đề phòng Client truyền nhầm 1 trong 2 biến, ta ưu tiên TeacherCorrection, nếu null thì lấy NewFeedback
                detailToUpdate.TeacherCorrection = !string.IsNullOrEmpty(correctionDto.TeacherCorrection)
                                                   ? correctionDto.TeacherCorrection
                                                   : correctionDto.NewFeedback;

                detailToUpdate.IsTeacherModified = true; // Cờ đánh dấu AI đã bị sửa

                // 4. Tính lại tổng điểm (TotalScore) dựa trên điểm mới sửa
                result.TotalScore = result.GradingDetails.Sum(d => d.FinalScore ?? d.AwardedScore);

                // 5. Lưu lại vào DB
                await _resultRepo.UpdateAsync(result.Id, result);

                return Ok(new { message = "Đã cập nhật điểm thành công!", newTotalScore = result.TotalScore });
            }

            return BadRequest("Không tìm thấy chi tiết câu hỏi này.");
        }

        // ==========================================================
        // GIAI ĐOẠN 2: API XUẤT DỮ LIỆU CSV (Giữ nguyên như lúc nãy)
        // ==========================================================
        [HttpGet("export-training-dataset")]
        public async Task<IActionResult> ExportTrainingDataset()
        {
            var allResults = await _resultRepo.GetAllAsync();
            var sb = new System.Text.StringBuilder();

            sb.AppendLine("RecognizedText,AIFeedback,AIAwardedScore,TeacherCorrection,TeacherFinalScore");
            int exportedCount = 0;

            foreach (var result in allResults)
            {
                var modifiedDetails = result.GradingDetails.Where(d => d.IsTeacherModified).ToList();

                foreach (var detail in modifiedDetails)
                {
                    string recognizedText = EscapeCsv(detail.RecognizedText);
                    string aiFeedback = EscapeCsv(detail.AIFeedback);
                    string aiScore = detail.AwardedScore.ToString();
                    string teacherCorrection = EscapeCsv(detail.TeacherCorrection);
                    string teacherScore = detail.FinalScore?.ToString() ?? aiScore;

                    sb.AppendLine($"{recognizedText},{aiFeedback},{aiScore},{teacherCorrection},{teacherScore}");
                    exportedCount++;
                }
            }

            if (exportedCount == 0)
                return Ok("Chưa có dữ liệu nào bị sửa đổi để xuất Dataset.");

            var fileBytes = System.Text.Encoding.UTF8.GetBytes(sb.ToString());
            var fileBytesWithBom = new byte[] { 0xEF, 0xBB, 0xBF }.Concat(fileBytes).ToArray();

            return File(fileBytesWithBom, "text/csv", $"AI_Training_Dataset_{System.DateTime.UtcNow:yyyyMMdd_HHmm}.csv");
        }

        private string EscapeCsv(string text)
        {
            if (string.IsNullOrEmpty(text)) return "\"\"";
            text = text.Replace("\"", "\"\"");
            return $"\"{text}\"";
        }
    }
}