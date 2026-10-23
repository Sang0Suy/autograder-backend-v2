using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.Entities;
using AutoGrader.Infrastructure.Services;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GradingController : ControllerBase
    {
        private readonly IGradingWorkflowService _workflowService;
        private readonly IRepository<StudentResult> _resultRepo;
        private readonly IRubricService _rubricService;
        private readonly ITaskCancellationManager _cancelManager;
        private readonly IRepository<Student> _studentRepo;
        private readonly IRepository<StudentProfile> _profileRepo;

        public GradingController(IGradingWorkflowService workflowService, IRepository<StudentResult> resultRepo, IRubricService rubricService, ITaskCancellationManager cancelManager, IRepository<Student> studentRepo, IRepository<StudentProfile> profileRepo)
        {
            _workflowService = workflowService;
            _resultRepo = resultRepo;
            _rubricService = rubricService;
            _cancelManager = cancelManager;
            _studentRepo = studentRepo;
            _profileRepo = profileRepo;
        }

        [HttpGet("results")]
        [Authorize(Roles = "Admin,Teacher,Student")]
        public async Task<IActionResult> GetPagedResults([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string testId = null)
        {
            try
            {
                System.Linq.Expressions.Expression<Func<StudentResult, bool>> filter = null;
                bool isStudent = User.IsInRole("Student");

                if (isStudent)
                {
                    string myStudentCode = User.FindFirst("ReferenceId")?.Value;
                    if (!string.IsNullOrEmpty(testId)) filter = x => x.StudentCode == myStudentCode && x.TestId == testId;
                    else filter = x => x.StudentCode == myStudentCode;
                }
                else
                {
                    if (!string.IsNullOrEmpty(testId)) filter = x => x.TestId == testId;
                }

                var (data, totalCount) = await _resultRepo.GetPagedAsync(page, pageSize, filter);

                return Ok(new
                {
                    Data = data,
                    TotalCount = totalCount,
                    CurrentPage = page,
                    TotalPages = (int)Math.Ceiling((double)totalCount / pageSize)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }

        [HttpPost("auto-grade")]
        public async Task<IActionResult> AutoGrade([FromForm] StudentSubmissionDto request)
        {
            if (request.ImageFile == null || request.ImageFile.Length == 0) return BadRequest("Vui lòng đính kèm ảnh bài làm.");
            if (string.IsNullOrEmpty(request.TestId)) return BadRequest("Không có thông tin mã đề thi.");
            if (string.IsNullOrEmpty(request.StudentCode)) return BadRequest("Không có thông tin mã học sinh.");

            if (request.StudentCode == "AUTO" && User.IsInRole(AppRoles.Student)) return StatusCode(403, "Học sinh không được dùng tính năng chấm tự động hàng loạt.");

            if (User.IsInRole(AppRoles.Student))
            {
                var myStudentCode = User.FindFirst("ReferenceId")?.Value;
                if (!string.Equals(myStudentCode, request.StudentCode, StringComparison.OrdinalIgnoreCase)) return StatusCode(403, "Gian lận! Bạn không có quyền nộp bài thay cho học sinh khác.");
            }

            try
            {
                var result = await _workflowService.ProcessSubmissionAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi hệ thống: {ex.Message}");
            }
        }

        [HttpPut("{id}/correction")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> UpdateTeacherCorrection(string id, [FromBody] TeacherCorrectionDto dto)
        {
            try
            {
                var result = await _resultRepo.GetByIdAsync(id);
                if (result == null) return NotFound("Không tìm thấy bài làm này trong hệ thống.");

                var detail = result.GradingDetails.FirstOrDefault(q => q.QuestionNumber == dto.QuestionNumber);
                if (detail == null) return BadRequest("Không tìm thấy câu hỏi này trong bài làm.");

                detail.FinalScore = dto.NewScore;
                detail.TeacherCorrection = dto.TeacherCorrection;
                detail.IsTeacherModified = true;

                result.TotalScore = result.GradingDetails.Sum(d => d.FinalScore ?? d.AwardedScore);

                await _resultRepo.UpdateAsync(id, result);
                return Ok(new
                {
                    message = "Đã cập nhật điểm thành công! Dữ liệu này sẽ được dùng để huấn luyện AI.",
                    data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }

        [HttpPost("omr-grade")]
        public async Task<IActionResult> OmrGrade([FromForm] StudentSubmissionDto request)
        {
            if (request.ImageFile == null || request.ImageFile.Length == 0) return BadRequest("Vui lòng đính kèm ảnh phiếu trắc nghiệm.");
            if (string.IsNullOrEmpty(request.TestId) || string.IsNullOrEmpty(request.StudentCode)) return BadRequest("Thiếu thông tin mã đề thi hoặc mã học sinh.");

            try
            {
                AIGradingResult result;
                if (string.Equals(request.GradingMode, "ai", StringComparison.OrdinalIgnoreCase))
                {
                    result = await _workflowService.ProcessAiSubmissionAsync(request);
                }
                else
                {
                    result = await _workflowService.ProcessOmrSubmissionAsync(request);
                    // 🔥 Truyền thêm request.TestId để xác định loại đề
                    await SyncScoreToStudentDashboard(result, request.StudentCode, request.TestId);
                    await UpdateStudentGamificationAsync(request.StudentCode, result.TotalScore);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi hệ thống: {ex.Message}");
            }
        }

        [HttpPost("online-grade")]
        public async Task<IActionResult> OnlineGrade([FromBody] OnlineSubmissionDto request)
        {
            try
            {
                var result = await _workflowService.ProcessOnlineSubmissionAsync(request);
                // 🔥 Truyền thêm request.TestId
                await SyncScoreToStudentDashboard(result, request.StudentCode, request.TestId);
                await UpdateStudentGamificationAsync(request.StudentCode, result.TotalScore);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Lỗi hệ thống: " + ex.Message });
            }
        }

        [HttpPost("ai-grade")]
        public async Task<IActionResult> GradeAiSubmission([FromForm] StudentSubmissionDto request)
        {
            try
            {
                var result = await _workflowService.ProcessAiSubmissionAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        [HttpPost("cancel/{resultId}")]
        [Authorize(Roles = "Admin,Teacher")]
        public IActionResult CancelGradingTask(string resultId)
        {
            _cancelManager.CancelTask(resultId);
            return Ok(new { message = "Đã gửi lệnh hủy tiến trình chấm bài AI thành công!" });
        }

        [HttpGet("queue-status")]
        [AllowAnonymous]
        public IActionResult GetQueueStatus([FromServices] IGradingTaskQueue queue)
        {
            return Ok(new { pendingCount = queue.GetPendingCount() });
        }

        [HttpGet("result/{id}")]
        public async Task<IActionResult> GetGradingResult(string id)
        {
            var result = await _resultRepo.GetByIdAsync(id);
            if (result == null) return NotFound("Không tìm thấy kết quả bài thi.");

            return Ok(result);
        }

        // 🔥 HÀM ĐỒNG BỘ ĐIỂM SIÊU THÔNG MINH
        private async Task SyncScoreToStudentDashboard(AIGradingResult result, string studentCode, string testId)
        {
            if (string.IsNullOrEmpty(studentCode)) return;

            var allStudents = await _studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == studentCode.Trim().ToLower());

            if (student != null)
            {
                if (student.ExtraAttributes == null)
                {
                    student.ExtraAttributes = new Dictionary<string, object>();
                }

                // 1. Mặc định là cột Điểm Thi
                string targetColumn = "Điểm Thi";

                // 2. Tìm xem Đề thi này tên gì / loại gì để chuyển cột cho đúng
                if (!string.IsNullOrEmpty(testId))
                {
                    var rubric = await _rubricService.GetRubricByIdAsync(testId);
                    if (rubric != null)
                    {
                        var titleLower = rubric.Title.ToLower();
                        if (titleLower.Contains("15p") || titleLower.Contains("15 phút"))
                        {
                            targetColumn = "Điểm 15p";
                        }
                        else if (titleLower.Contains("45p") || titleLower.Contains("45 phút"))
                        {
                            targetColumn = "Điểm 45p";
                        }
                        else if (titleLower.Contains("thường xuyên") || titleLower.Contains("tx"))
                        {
                            targetColumn = "Điểm TX";
                        }
                    }
                }

                // 3. Ghi điểm vào đúng cột
                student.ExtraAttributes[targetColumn] = result.TotalScore;

                await _studentRepo.UpdateAsync(student.Id, student);
            }
        }
        // 🔥 HÀM TÍNH ĐIỂM KINH NGHIỆM (XP) VÀ CẬP NHẬT RANK CHO HỌC SINH
        private async Task UpdateStudentGamificationAsync(string studentCode, double totalScore)
        {
            if (string.IsNullOrEmpty(studentCode)) return;

            var allProfiles = await _profileRepo.GetAllAsync();
            var profile = allProfiles.FirstOrDefault(p => p.StudentCode.Trim().ToLower() == studentCode.Trim().ToLower());

            // Nếu học sinh chưa có profile Gamification, tự động tạo mới
            if (profile == null)
            {
                profile = new StudentProfile
                {
                    StudentCode = studentCode,
                    TotalXP = 0,
                    Level = 1,
                    CurrentRank = "Đồng",
                    HighestScoreCount = 0
                };
                await _profileRepo.CreateAsync(profile);
            }

            // Quy luật thưởng XP dựa trên điểm số bài thi (Thang điểm 10)
            int earnedXp = 50; // Điểm chuyên cần mặc định khi hoàn thành bài
            if (totalScore >= 9.0)
            {
                earnedXp = 150; // Thưởng khủng cho điểm xuất sắc
                profile.HighestScoreCount++;
            }
            else if (totalScore >= 8.0) earnedXp = 100;
            else if (totalScore < 5.0) earnedXp = 20; // Điểm thấp vẫn có động lực

            profile.TotalXP += earnedXp;

            // Công thức tính Level đơn giản: Mỗi 500 XP lên 1 cấp độ
            profile.Level = (profile.TotalXP / 500) + 1;

            // Phân loại Rank dựa theo Level hoặc Tổng XP
            if (profile.TotalXP >= 2500) profile.CurrentRank = "Thách Đấu 💎";
            else if (profile.TotalXP >= 1500) profile.CurrentRank = "Kim Cương 💠";
            else if (profile.TotalXP >= 1000) profile.CurrentRank = "Bạch Kim 👑";
            else if (profile.TotalXP >= 600) profile.CurrentRank = "Vàng ⭐";
            else if (profile.TotalXP >= 300) profile.CurrentRank = "Bạc 🥈";
            else profile.CurrentRank = "Đồng 🥉";

            await _profileRepo.UpdateAsync(profile.Id, profile);
        }
        // ==========================================
        // API MỚI: XỬ LÝ VI PHẠM / BỎ QUA CẢNH BÁO
        // ==========================================
        public class ResolveFlagDto
        {
            public string Action { get; set; } = string.Empty; // "penalize" (Phạt) hoặc "ignore" (Bỏ qua)
        }

        [HttpPut("{id}/resolve-flag")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> ResolveFlag(string id, [FromBody] ResolveFlagDto dto)
        {
            try
            {
                var result = await _resultRepo.GetByIdAsync(id);
                if (result == null) return NotFound("Không tìm thấy kết quả bài thi này.");

                if (dto.Action == "penalize")
                {
                    // 1. Phạt 0 điểm toàn bài
                    result.TotalScore = 0;

                    // 🔥 SỬA DÒNG NÀY: Thay OverallFeedback bằng PlagiarismNote
                    result.PlagiarismNote = "❌ Bài làm bị hủy kết quả (0 điểm) do vi phạm quy chế thi / đạo văn.";

                    // 2. Ép tất cả các câu về 0 điểm
                    if (result.GradingDetails != null)
                    {
                        foreach (var detail in result.GradingDetails)
                        {
                            detail.FinalScore = 0;
                            detail.TeacherCorrection = "Hủy điểm do vi phạm quy chế.";
                            detail.IsTeacherModified = true;
                        }
                    }
                }
                else if (dto.Action == "ignore")
                {
                    // Gỡ bỏ toàn bộ cờ đỏ
                    result.IsPlagiarized = false;
                    result.NeedsManualReview = false;
                    result.PlagiarismNote = "";
                }

                await _resultRepo.UpdateAsync(id, result);

                return Ok(new
                {
                    message = dto.Action == "penalize" ? "Đã xử phạt 0 điểm!" : "Đã gỡ cảnh báo thành công!",
                    data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Lỗi server: {ex.Message}");
            }
        }
    }
}