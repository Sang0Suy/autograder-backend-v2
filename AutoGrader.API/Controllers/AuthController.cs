using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Constants;
using AutoGrader.Domain.DTOs;
using AutoGrader.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IRepository<User> _userRepository;

        // 🔥 ĐÃ XÓA IMongoClient ĐỂ KHÔNG BỊ CRASH DI VÀ ĐỒNG BỘ COLLECTION "User"
        public AuthController(IConfiguration configuration, IRepository<User> userRepository)
        {
            _configuration = configuration;
            _userRepository = userRepository;
        }

        public class LoginRequest
        {
            public string Username { get; set; } = null!;
            public string Password { get; set; } = null!;
        }

        public class RegisterRequest
        {
            public string Username { get; set; } = null!;
            public string Password { get; set; } = null!;
            public string FullName { get; set; } = null!;
            public string Role { get; set; } = null!;
            public string? ReferenceId { get; set; }
        }

        // ==========================================
        // 1. API ĐĂNG NHẬP 
        // ==========================================
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var users = await _userRepository.FindAsync(u => u.Username == request.Username);
            var user = users.FirstOrDefault();

            if (user == null)
            {
                if (request.Username == "admin" && request.Password == "123456")
                {
                    var fallbackToken = GenerateJwtToken("admin_id", "admin", "Quản trị viên (Mặc định)", AppRoles.Admin, null);
                    return Ok(new
                    {
                        token = fallbackToken,
                        role = AppRoles.Admin,
                        username = "admin",
                        fullName = "Quản trị viên (Mặc định)",
                        message = "Đăng nhập Admin mặc định thành công!"
                    });
                }
                return Unauthorized("Tài khoản không tồn tại!");
            }

            bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            if (!isPasswordValid) return Unauthorized("Mật khẩu không chính xác!");

            var token = GenerateJwtToken(user.Id!, user.Username, user.FullName, user.Role, user.ReferenceId);
            return Ok(new
            {
                token,
                role = user.Role,
                username = user.Username,
                fullName = user.FullName,
                email = user.Email,
                phone = user.Phone,
                message = $"Chào mừng {user.FullName}!"
            });
        }

        // ==========================================
        // 2. API TẠO TÀI KHOẢN (CHỈ ADMIN MỚI ĐƯỢC DÙNG)
        // ==========================================
        [HttpPost("register")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            var users = await _userRepository.GetAllAsync();
            if (users.Any(u => u.Username == request.Username))
            {
                return BadRequest("Tên đăng nhập này đã được sử dụng!");
            }

            if (request.Role == AppRoles.Student && !string.IsNullOrEmpty(request.ReferenceId))
            {
                bool isCodeMapped = users.Any(u => u.Role == AppRoles.Student && u.ReferenceId == request.ReferenceId);
                if (isCodeMapped)
                {
                    return BadRequest($"Mã học sinh '{request.ReferenceId}' này đã được cấp cho một tài khoản khác rồi!");
                }
            }

            var newUser = new User
            {
                Username = request.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FullName = request.FullName,
                Role = request.Role,
                ReferenceId = request.ReferenceId
            };

            await _userRepository.CreateAsync(newUser);

            return Ok(new { message = $"Đã cấp tài khoản thành công cho {request.FullName} ({request.Role})" });
        }

        private string GenerateJwtToken(string userId, string username, string fullName, string role, string? referenceId)
        {
            var jwtSettings = _configuration.GetSection("Jwt");
            var key = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(jwtSettings["Key"]!));

            var claims = new List<Claim>
            {
                new Claim("UserId", userId),
                new Claim(JwtRegisteredClaimNames.Sub, username),
                new Claim(ClaimTypes.Name, username),
                new Claim("FullName", fullName),
                new Claim(ClaimTypes.Role, role),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            if (!string.IsNullOrEmpty(referenceId)) claims.Add(new Claim("ReferenceId", referenceId));

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddHours(2),
                Issuer = jwtSettings["Issuer"],
                Audience = jwtSettings["Audience"],
                SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature)
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }

        // ==========================================
        // 3. LẤY DANH SÁCH & 4. XÓA TÀI KHOẢN
        // ==========================================
        [HttpGet("users")]
        [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Teacher}")]
        public async Task<IActionResult> GetAllUsers()
        {
            var users = await _userRepository.GetAllAsync();
            var safeUsers = users.Select(u => new {
                u.Id,
                u.Username,
                u.FullName,
                u.Email,
                u.Phone,
                u.Role,
                u.ReferenceId,
                u.AllowedClasses
            });
            return Ok(safeUsers);
        }

        [HttpDelete("users/{id}")]
        [Authorize(Roles = AppRoles.Admin)]
        public async Task<IActionResult> DeleteUser(string id)
        {
            await _userRepository.DeleteAsync(id);
            return Ok(new { message = "Đã xóa tài khoản!" });
        }

        [HttpPut("{id}/assign-classes")]
        [Authorize]
        public async Task<IActionResult> AssignClassesToTeacher(string id, [FromBody] List<string> allowedClasses)
        {
            var teacher = await _userRepository.GetByIdAsync(id);
            if (teacher == null) return NotFound("Không tìm thấy giáo viên.");

            var cleanClasses = allowedClasses
                .Select(c => c.Trim().ToLower())
                .Distinct()
                .ToList();

            teacher.AllowedClasses = cleanClasses;
            await _userRepository.UpdateAsync(id, teacher);

            return Ok(new { Message = "Đã cập nhật phân công lớp thành công!", AllowedClasses = cleanClasses });
        }

        // ==========================================
        // 5. ĐỔI MẬT KHẨU (DÙNG IRepository<User>)
        // ==========================================
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var users = await _userRepository.FindAsync(u => u.Username == dto.Username);
            var user = users.FirstOrDefault();

            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản trong cơ sở dữ liệu!" });
            }

            bool isPasswordCorrect = BCrypt.Net.BCrypt.Verify(dto.OldPassword, user.PasswordHash);
            if (!isPasswordCorrect)
            {
                return BadRequest(new { message = "Mật khẩu hiện tại không chính xác!" });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            await _userRepository.UpdateAsync(user.Id!, user);

            return Ok(new { message = "Đổi mật khẩu thành công!" });
        }

        // ==========================================
        // 6. CẬP NHẬT THÔNG TIN CÁ NHÂN
        // ==========================================
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var users = await _userRepository.FindAsync(u => u.Username == dto.Username);
            var user = users.FirstOrDefault();

            if (user == null)
            {
                return NotFound(new { message = "Không tìm thấy tài khoản!" });
            }

            user.FullName = dto.FullName;
            user.Email = dto.Email;
            user.Phone = dto.Phone;

            await _userRepository.UpdateAsync(user.Id!, user);

            return Ok(new
            {
                message = "Cập nhật hồ sơ thành công!",
                fullName = user.FullName,
                email = user.Email,
                phone = user.Phone
            });
        }
    }
}