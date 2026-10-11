using Microsoft.AspNetCore.Http;

namespace AutoGrader.Application.DTOs
{
    public class StudentSubmissionDto
    {
        public string TestId { get; set; } = string.Empty;
        public string StudentCode { get; set; } = string.Empty;
        public IFormFile ImageFile { get; set; } = null!;
        // 🔥 Thêm trường GradingMode để Backend biết dùng OMR hay AI đa định dạng
        public string GradingMode { get; set; } = "omr";
    }
}