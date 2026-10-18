namespace AutoGrader.Domain.DTOs
{
    public class CreateFeedbackDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int Rating { get; set; } = 5;
    }
}