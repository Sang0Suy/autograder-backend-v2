namespace AutoGrader.Application.DTOs
{
    public class TeacherCorrectionDto
    {
        public string ResultId { get; set; } = string.Empty; // Mã bài làm của học sinh
        public int QuestionNumber { get; set; } // Câu hỏi số mấy bị chấm sai?
        public double NewScore { get; set; } // Điểm giáo viên muốn sửa thành
        public string NewFeedback { get; set; } = string.Empty; // Lời phê thực tế của giáo viên
        public string TeacherCorrection { get; set; } = string.Empty; // Lời phê thực tế của giáo viên
    }
}