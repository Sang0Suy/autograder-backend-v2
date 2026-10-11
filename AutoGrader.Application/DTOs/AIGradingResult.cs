namespace AutoGrader.Application.DTOs
{
    // Báo cáo tổng thể bài thi
    public class AIGradingResult
    {
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty;
        public double TotalScore { get; set; } // Tổng điểm AI chấm
        public string OverallFeedback { get; set; } = string.Empty; // Nhận xét chung toàn bài
        public List<GradingDetailDto> Details { get; set; } = new(); // Chi tiết điểm từng câu
    }

    // Chi tiết điểm của 1 câu hỏi cụ thể
    public class GradingDetailDto
    {
        public int QuestionNumber { get; set; } // Câu số mấy
        public double AwardedScore { get; set; } // Điểm đạt được
        public string RecognizedText { get; set; } = string.Empty; // Câu trả lời của học sinh (OCR đọc được)
        public string AIFeedback { get; set; } = string.Empty; // Nhận xét vì sao được điểm này
    }
}