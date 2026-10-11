using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class StudentResultsController : ControllerBase
    {
        private readonly IRepository<StudentResult> _studentResultRepository;

        public StudentResultsController(IRepository<StudentResult> studentResultRepository)
        {
            _studentResultRepository = studentResultRepository;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var results = await _studentResultRepository.GetAllAsync();
            var role = User.FindFirst(ClaimTypes.Role)?.Value;
            var username = User.Identity?.Name;

            // 🔥 BỨC TƯỜNG CÁCH LY DỮ LIỆU
            if (role == AppRoles.Teacher)
            {
                results = results.Where(r => r.CreatedBy == username).ToList();
            }
            else if (role == "Student")
            {
                var studentCode = User.FindFirst("ReferenceId")?.Value;
                results = results.Where(r => r.StudentCode != null && r.StudentCode.ToLower() == studentCode?.ToLower()).ToList();
            }

            return Ok(results.OrderByDescending(r => r.GradedAt));
        }
    }
}