using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;

namespace AutoGrader.Application.Services
{
    public class BatchGradingJob
    {
        private readonly IRepository<Test> _testRepo;
        private readonly IRepository<StudentResult> _resultRepo;
        private readonly IAIGradingService _aiGradingService;
        private readonly IExpoNotificationService _notificationService;
        private readonly PlagiarismDetectionService _plagiarismService;

        public BatchGradingJob(
            IRepository<Test> testRepo,
            IRepository<StudentResult> resultRepo,
            IAIGradingService aiGradingService,
            IExpoNotificationService notificationService,
            PlagiarismDetectionService plagiarismService) // 🔥 Tiêm Service Đạo văn vào đây
        {
            _testRepo = testRepo;
            _resultRepo = resultRepo;
            _aiGradingService = aiGradingService;
            _notificationService = notificationService;
            _plagiarismService = plagiarismService;
        }

        public async Task ProcessClassGradingAsync(string testId, string teacherToken)
        {
            var test = await _testRepo.GetByIdAsync(testId);
            if (test == null) return;

            // Lấy toàn bộ bài thi
            var allResults = await _resultRepo.FindAsync(r => r.TestId == testId);

            if (allResults.Count() < test.TotalStudents)
            {
                return;
            }

            int flaggedCount = 0; // Biến đếm số lượng bài thi cần duyệt lại

            // Tách riêng danh sách các bài ĐÃ CHẤM XONG để làm dữ liệu gốc đi so sánh đạo văn
            var gradedResults = allResults.Where(r => r.IsGraded).ToList();
            var ungradedResults = allResults.Where(r => !r.IsGraded).ToList();

            foreach (var result in ungradedResults)
            {
                string firstRubricId = test.RubricIds.FirstOrDefault() ?? string.Empty;

                // 1. Gọi AI trả về gói kết quả gồm Điểm, Độ tự tin, Lộ trình học và cả Text bóc tách
                var aiResult = await _aiGradingService.GradeAnswerAsync("", "", result.PaperImageUrl, firstRubricId);

                result.TotalScore = aiResult.TotalScore;
                result.ConfidenceScore = aiResult.ConfidenceScore;
                result.StudyGuide = aiResult.StudyGuide;
                result.IsGraded = true;

                // Lưu lại mảng chi tiết bài làm vào DB (Rất quan trọng để lưu lại chữ AI đã đọc)
                if (aiResult.Details != null)
                {
                    // Ánh xạ từ DTO sang Entity (Giả định bạn đã có mapping phù hợp)
                    result.GradingDetails = aiResult.Details.Select(d => new GradingDetail
                    {
                        QuestionNumber = d.QuestionNumber,
                        AwardedScore = d.AwardedScore,
                        RecognizedText = d.RecognizedText,
                        AIFeedback = d.AIFeedback
                    }).ToList();
                }

                // 🔥 LOGIC 1: KIỂM TRA ĐẠO VĂN (PHƯƠNG ÁN 5)
                // Nối tất cả các câu trả lời của học sinh này thành 1 chuỗi dài
                string currentText = string.Join(" ", result.GradingDetails.Select(d => d.RecognizedText));
                bool isPlagiarized = false;

                foreach (var pastResult in gradedResults)
                {
                    string pastText = string.Join(" ", pastResult.GradingDetails.Select(d => d.RecognizedText));
                    double similarity = _plagiarismService.CalculateSimilarity(currentText, pastText);

                    if (similarity > 0.85) // Giống nhau trên 85%
                    {
                        result.IsPlagiarized = true;
                        result.NeedsManualReview = true;
                        result.PlagiarismNote = $"⚠️ Đạo văn: Giống {(similarity * 100):0.0}% với bài của {pastResult.StudentName}.";
                        isPlagiarized = true;
                        flaggedCount++;
                        break; // Đã bắt được quả tang thì ngừng quét bài này
                    }
                }

                // 🔥 LOGIC 2: ĐÁNH GIÁ ĐỘ TIN CẬY (PHƯƠNG ÁN 3)
                if (!isPlagiarized && result.ConfidenceScore < 80.0)
                {
                    result.NeedsManualReview = true;
                    flaggedCount++;
                }

                await _resultRepo.UpdateAsync(result.Id, result);

                // Thêm bài vừa chấm sạch vào kho dữ liệu để đi so sánh với các bài tiếp theo
                if (!isPlagiarized)
                {
                    gradedResults.Add(result);
                }
            }

            // Kích hoạt Firebase bắn thông báo cho Giáo viên với kịch bản linh hoạt
            string title = "Hoàn tất chấm điểm! 📝";
            string body = $"Hệ thống đã tự động chấm xong {test.TotalStudents} bài môn {test.Title}. ";

            if (flaggedCount > 0)
            {
                title = "⚠️ Có bài thi cần duyệt lại!";
                body += $"\nPhát hiện {flaggedCount} bài thi có dấu hiệu đạo văn hoặc chữ viết không rõ. Vui lòng kiểm tra trên hệ thống.";
            }
            else
            {
                body += "100% bài thi đạt độ tin cậy an toàn.";
            }

            await _notificationService.SendPushNotificationAsync(teacherToken, title, body);
        }

        public async Task ProcessGradingAsync(string token, string studentName, double score)
        {
            await Task.Delay(5000);
            string title = "AutoGrader: Có kết quả mới! 📝";
            string body = $"Hệ thống đã chấm xong bài của {studentName}. Điểm: {score}/10. Chúc mừng bạn!";
            await _notificationService.SendPushNotificationAsync(token, title, body);
        }
    }
}