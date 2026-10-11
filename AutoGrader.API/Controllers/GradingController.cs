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

        public GradingController(IGradingWorkflowService workflowService, IRepository<StudentResult> resultRepo, IRubricService rubricService, ITaskCancellationManager cancelManager, IRepository<Student> studentRepo)
        {
            _workflowService = workflowService;
            _resultRepo = resultRepo;
            _rubricService = rubricService;
            _cancelManager = cancelManager;
            _studentRepo = studentRepo;
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
    }
}