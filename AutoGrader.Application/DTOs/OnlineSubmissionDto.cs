using System.Collections.Generic;

namespace AutoGrader.Application.DTOs
{
    public class OnlineSubmissionDto
    {
        public string TestId { get; set; }
        public string StudentCode { get; set; }
        public string StudentName { get; set; }
        public Dictionary<int, string> Answers { get; set; } = new Dictionary<int, string>();
    }
}