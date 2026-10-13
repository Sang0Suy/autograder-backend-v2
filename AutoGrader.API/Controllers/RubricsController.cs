using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class RubricsController : ControllerBase
    {
        private readonly IRepository<Rubric> _rubricRepository;
        private readonly IAIGradingService _aiGradingService;
        private readonly IRepository<Rubric> _rubricRepo;
        public RubricsController(IRepository<Rubric> rubricRepository, IAIGradingService aiGradingService, IRepository<Rubric> rubricRepo)
        {
            _rubricRepository = rubricRepository;
            _aiGradingService = aiGradingService;
            _rubricRepo = rubricRepo;
        }

        [HttpGet]
        [Authorize(Roles = "Admin,Teacher,Student")]
        public async Task<IActionResult> GetAll()
        {
            var rubrics = await _rubricRepository.GetAllAsync();
            var sortedRubrics = rubrics.OrderByDescending(r => r.CreatedAt).AsEnumerable();

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (role == AppRoles.Teacher)
            {
                var username = User.Identity?.Name;
                sortedRubrics = sortedRubrics.Where(r => r.CreatedBy == username);
            }

            return Ok(sortedRubrics.ToList());
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Admin,Teacher,Student")]
        public async Task<IActionResult> GetById(string id)
        {
            var rubric = await _rubricRepository.GetByIdAsync(id);
            if (rubric == null) return NotFound("Không tìm thấy bộ barem này!");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && rubric.CreatedBy != username)
            {
                return StatusCode(403, "Bạn không có quyền xem đề thi của giáo viên khác!");
            }

            return Ok(rubric);
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Create([FromBody] Rubric newRubric)
        {
            newRubric.Id = string.Empty;
            newRubric.CreatedAt = DateTime.UtcNow;

            // ĐÓNG DẤU CHỦ SỞ HỮU TỪ TOKEN
            newRubric.CreatedBy = User.Identity?.Name ?? string.Empty;

            await _rubricRepository.CreateAsync(newRubric);
            return Ok(new { message = "Đã lưu bộ barem và đề thi thành công!" });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Update(string id, [FromBody] Rubric updatedRubric)
        {
            var existing = await _rubricRepository.GetByIdAsync(id);
            if (existing == null) return NotFound("Không tìm thấy bộ barem này để sửa!");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && existing.CreatedBy != username)
                return StatusCode(403, "Xâm phạm dữ liệu! Bạn không thể sửa đề của người khác.");

            updatedRubric.Id = id;
            updatedRubric.CreatedBy = existing.CreatedBy; // Bảo lưu thông tin chủ gốc
            await _rubricRepository.UpdateAsync(id, updatedRubric);
            return Ok(new { message = "Cập nhật bộ barem thành công!" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Teacher")]
        public async Task<IActionResult> Delete(string id)
        {
            var existing = await _rubricRepository.GetByIdAsync(id);
            if (existing == null) return NotFound("Không tìm thấy bộ barem này để xóa!");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && existing.CreatedBy != username)
                return StatusCode(403, "Xâm phạm dữ liệu! Bạn không thể xóa đề của người khác.");

            await _rubricRepository.DeleteAsync(id);
            return Ok(new { message = "Đã xóa bộ barem thành công!" });
        }
        // API Sinh Rubric tự động
        [HttpPost("auto-generate")]
        public async Task<IActionResult> AutoGenerateRubric([FromBody] GenerateRubricRequest request)
        {
            if (string.IsNullOrEmpty(request.AnswerKeyImageUrl))
                return BadRequest("Vui lòng cung cấp link ảnh đáp án.");

            // 1. Gọi AI bóc tách ảnh thành Rubric
            var newRubric = await _aiGradingService.GenerateRubricFromImageAsync(request.AnswerKeyImageUrl);

            if (newRubric == null)
                return StatusCode(500, "AI không thể nhận diện được đáp án từ ảnh.");

            // 2. Tùy chọn bổ sung dữ liệu (Ai tạo, tạo khi nào...)
            newRubric.CreatedBy = request.TeacherId;

            // 3. Lưu vào MongoDB
            await _rubricRepo.CreateAsync(newRubric);

            return Ok(new
            {
                message = "Đã tạo Barem điểm tự động thành công!",
                data = newRubric
            });
        }
    }
    public class GenerateRubricRequest
    {
        public string AnswerKeyImageUrl { get; set; }
        public string TeacherId { get; set; }
    }
}