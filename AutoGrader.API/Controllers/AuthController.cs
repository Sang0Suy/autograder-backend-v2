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
            string safeUsername = request.Username?.Trim() ?? "";

            // 🔥 Dùng GetAllAsync để loại bỏ hoàn toàn lỗi phân biệt hoa/thường của MongoDB
            var users = await _userRepository.GetAllAsync();
            var user = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.Username) && u.Username.Equals(safeUsername, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
                if (safeUsername.ToLower() == "admin" && request.Password == "123456")
                {
                    user = new User
                    {
                        Username = "admin",
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("123456"),
                        FullName = "Quản trị viên",
                        Role = AppRoles.Admin
                    };
                    await _userRepository.CreateAsync(user);

                    // Lấy lại data từ DB để đảm bảo Object có ID chính thức
                    users = await _userRepository.GetAllAsync();
                    user = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.Username) && u.Username.Equals("admin", StringComparison.OrdinalIgnoreCase)) ?? user;
                }
                else
                {
                    return Unauthorized("Tài khoản không tồn tại!");
                }
            }
            else
            {
                bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
                if (!isPasswordValid) return Unauthorized("Mật khẩu không chính xác!");
            }

            // Phòng hờ trường hợp CreateAsync chưa kịp map ID, ta gán tạm Guid để tạo Token không bị crash
            var safeId = string.IsNullOrEmpty(user.Id) ? Guid.NewGuid().ToString() : user.Id;
            var token = GenerateJwtToken(safeId, user.Username, user.FullName, user.Role, user.ReferenceId);

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
            if (users.Any(u => u.Username.Equals(request.Username?.Trim(), StringComparison.OrdinalIgnoreCase)))
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
                Username = request.Username!.Trim(),
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
        // 3. LẤY DANH SÁCH TÀI KHOẢN
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
        // 5. ĐỔI MẬT KHẨU
        // ==========================================
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            string safeUsername = dto.Username?.Trim() ?? "";
            var users = await _userRepository.GetAllAsync();
            var user = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.Username) && u.Username.Equals(safeUsername, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
                // 🔥 In thẳng tên Username ra để dễ bắt bệnh nếu React gửi sai
                return NotFound(new { message = $"Không tìm thấy tài khoản '{safeUsername}' trong Database!" });
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
            string safeUsername = dto.Username?.Trim() ?? "";
            var users = await _userRepository.GetAllAsync();
            var user = users.FirstOrDefault(u => !string.IsNullOrEmpty(u.Username) && u.Username.Equals(safeUsername, StringComparison.OrdinalIgnoreCase));

            if (user == null)
            {
                return NotFound(new { message = $"Không tìm thấy tài khoản '{safeUsername}' trong Database!" });
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