namespace AutoGrader.Application.DTOs
{
    public class GradingTaskPayload
    {
        public string ResultId { get; set; } // ID của bài thi trong MongoDB
        public string ExtractedText { get; set; }
        public string RubricJson { get; set; }
        public string ImageUrl { get; set; }
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
    }
}