using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Teacher}")]
    public class TestsController : ControllerBase
    {
        private readonly ITestService _testService;

        public TestsController(ITestService testService)
        {
            _testService = testService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Test>>> GetAllTests()
        {
            var tests = await _testService.GetAllTestsAsync();

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            if (role == AppRoles.Teacher)
            {
                var username = User.Identity?.Name;
                tests = tests.Where(t => t.CreatedBy == username).ToList();
            }

            return Ok(tests);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Test>> GetTestById(string id)
        {
            var test = await _testService.GetTestByIdAsync(id);
            if (test == null) return NotFound($"Không tìm thấy bài kiểm tra với ID: {id}");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && test.CreatedBy != username)
                return StatusCode(403, "Bạn không có quyền xem bài kiểm tra này!");

            return Ok(test);
        }

        [HttpPost]
        public async Task<ActionResult<Test>> CreateTest([FromBody] Test test)
        {
            test.CreatedBy = User.Identity?.Name ?? string.Empty;
            var createdTest = await _testService.CreateTestAsync(test);

            return CreatedAtAction(nameof(GetTestById), new { id = createdTest.Id }, createdTest);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTest(string id, [FromBody] Test test)
        {
            var existingTest = await _testService.GetTestByIdAsync(id);
            if (existingTest == null) return NotFound($"Không tìm thấy bài kiểm tra với ID: {id}");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && existingTest.CreatedBy != username)
                return StatusCode(403, "Bạn không có quyền sửa bài kiểm tra này!");

            test.Id = id;
            test.CreatedBy = existingTest.CreatedBy; // Bảo tồn người tạo gốc
            await _testService.UpdateTestAsync(id, test);

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTest(string id)
        {
            var existingTest = await _testService.GetTestByIdAsync(id);
            if (existingTest == null) return NotFound($"Không tìm thấy bài kiểm tra với ID: {id}");

            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            if (role == AppRoles.Teacher && existingTest.CreatedBy != username)
                return StatusCode(403, "Bạn không có quyền xóa bài kiểm tra này!");

            await _testService.DeleteTestAsync(id);
            return NoContent();
        }
    }
}