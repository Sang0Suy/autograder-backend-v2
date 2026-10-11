using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StudentsController : ControllerBase
    {
        private readonly IRepository<Student> _studentRepository;
        private readonly IRepository<StudentResult> _resultRepository;
        private readonly IRepository<Rubric> _rubricRepository;

        // 🔥 BƯỚC 1: Tiêm thêm Repository của User để lấy mảng AllowedClasses
        // (Lưu ý: Nếu Model của bạn tên là AppUser thì đổi chữ User thành AppUser nhé)
        private readonly IRepository<User> _userRepository;

        public StudentsController(
            IRepository<Student> studentRepository,
            IRepository<StudentResult> resultRepository,
            IRepository<Rubric> rubricRepository,
            IRepository<User> userRepository) // Thêm tham số này
        {
            _studentRepository = studentRepository;
            _resultRepository = resultRepository;
            _rubricRepository = rubricRepository;
            _userRepository = userRepository;
        }

        // ==========================================
        // MỞ QUYỀN CHO HỌC SINH ĐỌC DANH SÁCH LỚP 
        // ==========================================
        [HttpGet]
        [Authorize(Roles = "Admin,Teacher,Student")]
        public async Task<ActionResult<IEnumerable<Student>>> GetAll()
        {
            var students = await _studentRepository.GetAllAsync();
            var role = User.FindFirst(ClaimTypes.Role)?.Value;

            if (role == AppRoles.Teacher)
            {
                // 🔥 BƯỚC 2: Xử lý lọc danh sách theo mảng AllowedClasses của Teacher
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var teacher = await _userRepository.GetByIdAsync(userId);

                // Nếu giáo viên chưa được Admin gán bất kỳ lớp nào -> Trả về mảng rỗng (không cho xem)
                if (teacher?.AllowedClasses == null || !teacher.AllowedClasses.Any())
                {
                    return Ok(new List<Student>());
                }

                // Chuẩn hóa tên lớp về in thường để so sánh không bị lệch
                var allowedClasses = teacher.AllowedClasses.Select(c => c.ToLower().Trim()).ToList();

                // Lọc học sinh: Chỉ lấy những em có tên lớp nằm trong mảng AllowedClasses
                students = students.Where(s =>
                    !string.IsNullOrWhiteSpace(s.ClassName) &&
                    allowedClasses.Contains(s.ClassName.ToLower().Trim())
                );
            }

            return Ok(students.OrderBy(s => s.ClassName).ThenBy(s => s.StudentCode).ToList());
        }

        // ==========================================
        // KHÓA QUYỀN THÊM/XÓA HỌC SINH 
        // ==========================================
        [HttpPost("import")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> ImportStudents([FromBody] List<Student> studentList)
        {
            var existingStudents = await _studentRepository.GetAllAsync();
            var username = User.Identity?.Name ?? string.Empty;

            int maxId = 0;
            foreach (var s in existingStudents)
            {
                if (!string.IsNullOrWhiteSpace(s.StudentCode) && s.StudentCode.StartsWith("HS"))
                {
                    string numberPart = s.StudentCode.Substring(2);
                    if (int.TryParse(numberPart, out int num))
                    {
                        if (num > maxId) maxId = num;
                    }
                }
            }

            foreach (var student in studentList)
            {
                if (string.IsNullOrWhiteSpace(student.StudentCode))
                {
                    maxId++;
                    student.StudentCode = $"HS{maxId:D3}";
                }
                else
                {
                    bool isDuplicate = existingStudents.Any(s => s.StudentCode.Trim().ToLower() == student.StudentCode.Trim().ToLower());
                    if (isDuplicate)
                    {
                        return BadRequest($"Lỗi: Mã học sinh '{student.StudentCode}' đã được sử dụng cho một học sinh khác!");
                    }
                }

                student.CreatedBy = username;
                await _studentRepository.CreateAsync(student);
            }

            return Ok(new { message = "Đã nhập danh sách học sinh thành công!" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Delete(string id)
        {
            var existing = await _studentRepository.GetByIdAsync(id);
            if (existing == null) return NotFound("Không tìm thấy học sinh này!");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;

            if (role == AppRoles.Teacher)
            {
                // 🔥 BƯỚC 3: Cập nhật quyền Xóa để tương thích với AllowedClasses
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var username = User.Identity?.Name;

                var teacher = await _userRepository.GetByIdAsync(userId);
                var allowedClasses = teacher?.AllowedClasses?.Select(c => c.ToLower().Trim()).ToList() ?? new List<string>();

                // Cho phép giáo viên xóa nếu: Học sinh do chính họ tạo RA, HOẶC học sinh đó nằm trong lớp họ quản lý
                bool canDelete = (existing.CreatedBy == username) ||
                                 (!string.IsNullOrWhiteSpace(existing.ClassName) && allowedClasses.Contains(existing.ClassName.ToLower().Trim()));

                if (!canDelete)
                {
                    return StatusCode(403, "Bạn không có quyền xóa học sinh của lớp khác!");
                }
            }

            await _studentRepository.DeleteAsync(id);
            return Ok(new { message = "Đã xóa học sinh vĩnh viễn!" });
        }

        // ==========================================
        // HOÀN THIỆN API TRẢ VỀ DASHBOARD CHO HỌC SINH
        // ==========================================
        [HttpGet("my-grades")]
        [Authorize(Roles = "Student")]
        public async Task<IActionResult> GetMyGrades()
        {
            var studentCode = User.FindFirst("ReferenceId")?.Value;
            if (string.IsNullOrEmpty(studentCode))
                return BadRequest("Tài khoản của bạn chưa được liên kết với mã học sinh nào trên hệ thống.");

            var students = await _studentRepository.GetAllAsync();
            var profile = students.FirstOrDefault(s => s.StudentCode.ToLower() == studentCode.ToLower());

            if (profile == null)
                return NotFound("Hồ sơ học sinh không tồn tại hoặc đã bị xóa.");

            var allResults = await _resultRepository.GetAllAsync();
            var myResults = allResults.Where(r =>
                !string.IsNullOrEmpty(r.StudentCode) &&
                r.StudentCode.ToLower() == studentCode.ToLower()
            ).ToList();

            var allRubrics = await _rubricRepository.GetAllAsync();

            int totalExams = myResults.Count;
            double averageScore = totalExams > 0 ? myResults.Average(r => r.TotalScore) : 0;
            int passedExams = myResults.Count(r => r.TotalScore >= 5.0);

            var recentProgress = myResults
                .OrderByDescending(r => r.GradedAt)
                .Take(5)
                .Select(r => new {
                    ExamName = allRubrics.FirstOrDefault(rub => rub.Id == r.TestId)?.Title ?? "Bài kiểm tra",
                    Score = r.TotalScore,
                    Date = r.GradedAt
                }).Reverse().ToList();
            /*mới*/
            return Ok(new
            {
                Profile = new
                {
                    profile.StudentCode,
                    profile.FullName,
                    profile.ClassName
                },
                Stats = new
                {
                    TotalExamsTaken = totalExams,
                    AverageScore = Math.Round(averageScore, 2),
                    PassedExams = passedExams,
                    FailedExams = totalExams - passedExams
                },
                RecentProgress = recentProgress,
                ScoreColumns = profile.ExtraAttributes
            });
        }
    }
}