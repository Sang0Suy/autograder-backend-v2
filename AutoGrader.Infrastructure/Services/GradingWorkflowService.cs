using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class GradingWorkflowService : IGradingWorkflowService
    {
        private readonly IOcrService _ocrService;
        private readonly IAIGradingService _aiGradingService;
        private readonly IRepository<StudentResult> _studentResultRepo;
        private readonly IRepository<Rubric> _rubricRepo;
        private readonly IRepository<Student> _studentRepo;
        private readonly IImageUploadService _imageUploadService;
        private readonly IOmrScannerService _omrScannerService;
        private readonly IGradingTaskQueue _taskQueue;
        private readonly IGradingNotificationService _notificationService;

        public GradingWorkflowService(
             IOcrService ocrService,
             IAIGradingService aiGradingService,
             IRepository<StudentResult> studentResultRepo,
             IRepository<Rubric> rubricRepo,
             IRepository<Student> studentRepo,
             IImageUploadService imageUploadService,
             IOmrScannerService omrScannerService,
             IGradingTaskQueue taskQueue,
             IGradingNotificationService notificationService)
        {
            _ocrService = ocrService;
            _aiGradingService = aiGradingService;
            _studentResultRepo = studentResultRepo;
            _rubricRepo = rubricRepo;
            _studentRepo = studentRepo;
            _imageUploadService = imageUploadService;
            _omrScannerService = omrScannerService;
            _taskQueue = taskQueue;
            _notificationService = notificationService;
        }

        // =================================================================
        // HÀM HELPER 1: Băm Hash từ Chuỗi (Dành cho Word/TXT)
        // =================================================================
        private string GenerateHash(string input)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(input);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash);
        }

        // =================================================================
        // HÀM HELPER 2: Băm Hash từ File Stream (Siêu tốc, dành cho Ảnh)
        // =================================================================
        private string GenerateHashFromStream(Stream stream)
        {
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(stream);
            return Convert.ToBase64String(hash);
        }

        // =================================================================
        // 1. LUỒNG CŨ: CHẤM BÀI ẢNH (AUTO-GRADE)
        // =================================================================
        public async Task<AIGradingResult> ProcessSubmissionAsync(StudentSubmissionDto request)
        {
            var rubric = await _rubricRepo.GetByIdAsync(request.TestId);
            if (rubric == null) throw new Exception("Không tìm thấy bộ đề thi trong hệ thống.");

            var allStudents = await _studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == request.StudentCode.Trim().ToLower());
            string exactStudentName = student != null ? student.FullName : "Khách vãng lai";

            using var imageStream = request.ImageFile.OpenReadStream();
            var studentAnswerText = await _ocrService.ExtractTextFromImageAsync(imageStream);
            if (string.IsNullOrWhiteSpace(studentAnswerText)) throw new Exception("Máy quét không nhận diện được chữ từ ảnh.");

            string rubricJson = JsonSerializer.Serialize(rubric);
            var finalResult = await _aiGradingService.GradeAnswerAsync(studentAnswerText, rubricJson);

            var imageUrl = await _imageUploadService.UploadImageAsync(request.ImageFile);

            var studentResult = new StudentResult
            {
                TestId = request.TestId,
                CreatedBy = rubric.CreatedBy, // 🔥 ĐÃ SỬA
                StudentCode = request.StudentCode,
                StudentName = exactStudentName,
                PaperImageUrl = imageUrl,
                TotalScore = finalResult.TotalScore,
                GradedAt = DateTime.UtcNow,
                GradingDetails = finalResult.Details.Select(d => new GradingDetail
                {
                    QuestionNumber = d.QuestionNumber,
                    AwardedScore = d.AwardedScore,
                    AIFeedback = d.AIFeedback,
                    TeacherCorrection = ""
                }).ToList()
            };

            await _studentResultRepo.CreateAsync(studentResult);
            // 🔥 ĐÃ SỬA
            await _notificationService.NotifyGradingCompletedAsync(studentResult.Id, rubric.CreatedBy);
            return finalResult;
        }

        // =================================================================
        // 2. LUỒNG CŨ: CHẤM OMR TỐC ĐỘ CAO BẰNG OPENCV
        // =================================================================
        public async Task<AIGradingResult> ProcessOmrSubmissionAsync(StudentSubmissionDto request)
        {
            var rubric = await _rubricRepo.GetByIdAsync(request.TestId);
            if (rubric == null) throw new Exception("Không tìm thấy bộ đề thi trong hệ thống.");

            var allStudents = await _studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == request.StudentCode.Trim().ToLower());
            string exactStudentName = student != null ? student.FullName : "Khách vãng lai";

            var studentAnswers = await _omrScannerService.ScanBubbleSheetAsync(request.ImageFile);

            double totalScore = 0;
            var gradingDetails = new List<GradingDetailDto>();

            var multipleChoiceQuestions = rubric.Questions
                .Where(q => q.QuestionType == "MultipleChoice")
                .OrderBy(q => q.Order)
                .ToList();

            for (int i = 0; i < multipleChoiceQuestions.Count; i++)
            {
                var question = multipleChoiceQuestions[i];
                string studentAns = (i < studentAnswers.Count) ? studentAnswers[i] : "N/A";
                bool isCorrect = string.Equals(studentAns, question.CorrectAnswer, StringComparison.OrdinalIgnoreCase);
                double scoreForQuestion = isCorrect ? question.MaxScore : 0;
                totalScore += scoreForQuestion;

                gradingDetails.Add(new GradingDetailDto
                {
                    QuestionNumber = question.Order,
                    RecognizedText = studentAns,
                    AwardedScore = scoreForQuestion,
                    AIFeedback = isCorrect
                        ? $"Chính xác. Đáp án chuẩn: {question.CorrectAnswer}."
                        : $"Sai. Đáp án chuẩn là: {question.CorrectAnswer}."
                });
            }

            var finalResult = new AIGradingResult
            {
                TotalScore = totalScore,
                OverallFeedback = $"Đã chấm xong phần trắc nghiệm. Đạt {totalScore} điểm.",
                Details = gradingDetails
            };

            var imageUrl = await _imageUploadService.UploadImageAsync(request.ImageFile);

            var studentResult = new StudentResult
            {
                TestId = request.TestId,
                CreatedBy = rubric.CreatedBy, // 🔥 ĐÃ SỬA
                StudentCode = request.StudentCode,
                StudentName = exactStudentName,
                PaperImageUrl = imageUrl,
                TotalScore = finalResult.TotalScore,
                GradedAt = DateTime.UtcNow,
                GradingDetails = gradingDetails.Select(d => new GradingDetail
                {
                    QuestionNumber = d.QuestionNumber,
                    RecognizedText = d.RecognizedText,
                    AwardedScore = d.AwardedScore,
                    AIFeedback = d.AIFeedback,
                    FinalScore = d.AwardedScore,
                    TeacherCorrection = "",
                    IsTeacherModified = false
                }).ToList()
            };

            await _studentResultRepo.CreateAsync(studentResult);
            // 🔥 ĐÃ SỬA
            await _notificationService.NotifyGradingCompletedAsync(studentResult.Id, rubric.CreatedBy);
            return finalResult;
        }

        // =================================================================
        // 🔥 3. LUỒNG MỚI (ĐÃ PHẪU THUẬT): CHỐNG LỖI 504 GATEWAY TIMEOUT
        // =================================================================
        public async Task<AIGradingResult> ProcessAiSubmissionAsync(StudentSubmissionDto request)
        {
            var rubric = await _rubricRepo.GetByIdAsync(request.TestId);
            if (rubric == null) throw new Exception("Không tìm thấy bộ đề thi trong hệ thống.");

            var allStudents = await _studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == request.StudentCode.Trim().ToLower());
            string exactStudentName = student != null ? student.FullName : "Khách vãng lai";
            string extension = Path.GetExtension(request.ImageFile.FileName).ToLower();

            // 🔥 BƯỚC 1: BĂM HASH TỪ FILE STREAM ĐỂ LÀM CACHE (CỰC NHANH)
            string contentHash;
            using (var stream = request.ImageFile.OpenReadStream())
            {
                contentHash = GenerateHashFromStream(stream) + "_" + request.TestId;
            }

            // BƯỚC 2: TÌM BÀI TRONG CACHE (Bỏ qua bài đang chờ/đang lỗi)
            var (cachedData, _) = await _studentResultRepo.GetPagedAsync(1, 1,
                 r => r.ContentHash == contentHash
                      && !string.IsNullOrEmpty(r.PaperImageUrl)
                      && !r.PaperImageUrl.Contains("(Đang chờ")
                      && !r.PaperImageUrl.Contains("(Lỗi")
                      && r.GradingDetails != null
                      && r.GradingDetails.Any());

            var cachedResult = cachedData.FirstOrDefault();

            string extractedText = "";
            string fileUrl = "";

            // 🔥 BƯỚC 3: THỬ TẢI FILE LÊN CLOUD (CÓ BẢO HIỂM)
            try
            {
                fileUrl = await _imageUploadService.UploadImageAsync(request.ImageFile);
            }
            catch
            {
                // Bỏ qua lỗi nếu Cloudinary từ chối định dạng Word/TXT
            }

            // NẾU CLOUD TỪ CHỐI -> GÁN TÊN CHUẨN ĐỂ FRONTEND KHÔNG BỊ TRỐNG NÚT BẤM
            if (string.IsNullOrWhiteSpace(fileUrl))
            {
                fileUrl = $"📄 File Tài Liệu ({extension.Replace(".", "").ToUpper()})";
            }

            // Bóc tách chữ
            if (extension == ".doc" || extension == ".docx")
            {
                extractedText = ExtractTextFromWord(request.ImageFile);
            }
            else if (extension == ".txt")
            {
                using var reader = new StreamReader(request.ImageFile.OpenReadStream());
                extractedText = await reader.ReadToEndAsync();
            }

            // 🚀 NẾU CÓ CACHE: TRẢ VỀ LUÔN
            if (cachedResult != null)
            {
                // 🔥 FIX BẪY CACHE: Lấy lại tên gốc trong Cache thay vì gán đè Khách vãng lai
                string finalCode = request.StudentCode;
                string finalName = exactStudentName;

                if (request.StudentCode == "AUTO" || string.IsNullOrEmpty(request.StudentCode))
                {
                    finalCode = cachedResult.StudentCode;
                    finalName = cachedResult.StudentName;
                }

                var instantResult = new StudentResult
                {
                    TestId = request.TestId,
                    CreatedBy = rubric.CreatedBy, // 🔥 ĐÃ SỬA
                    StudentCode = finalCode,
                    StudentName = finalName,
                    PaperImageUrl = fileUrl,
                    TotalScore = cachedResult.TotalScore,
                    GradedAt = DateTime.UtcNow,
                    GradingDetails = cachedResult.GradingDetails,
                    ContentHash = contentHash
                };

                await _studentResultRepo.CreateAsync(instantResult);
                // 🔥 ĐÃ SỬA
                await _notificationService.NotifyGradingCompletedAsync(instantResult.Id, rubric.CreatedBy);

                return new AIGradingResult
                {
                    Id = instantResult.Id,
                    TotalScore = cachedResult.TotalScore,
                    OverallFeedback = $"⚡ Lấy từ bộ nhớ đệm (Đã từng chấm bài này). Điểm: {cachedResult.TotalScore}đ",
                    Details = cachedResult.GradingDetails.Select(d => new GradingDetailDto
                    {
                        QuestionNumber = d.QuestionNumber,
                        RecognizedText = d.RecognizedText,
                        AwardedScore = d.AwardedScore,
                        AIFeedback = d.AIFeedback
                    }).ToList()
                };
            }

            // 🐢 NẾU LÀ BÀI MỚI: TẠO CHỖ TRỐNG TRONG DATABASE
            var studentResult = new StudentResult
            {
                TestId = request.TestId,
                CreatedBy = rubric.CreatedBy, // 🔥 ĐÃ SỬA
                StudentCode = request.StudentCode,
                // Ưu tiên tên tìm thấy trong DB, nếu không có mới dùng tên AI tìm được (nếu có), cuối cùng mới là Khách
                StudentName = (exactStudentName != "Khách vãng lai") ? exactStudentName : "Khách vãng lai",
                PaperImageUrl = fileUrl + " (Đang chờ AI chấm...)",
                TotalScore = 0,
                GradedAt = DateTime.UtcNow,
                GradingDetails = new List<GradingDetail>(),
                ContentHash = contentHash
            };

            await _studentResultRepo.CreateAsync(studentResult);
            // 🔥 ĐÃ SỬA
            await _notificationService.NotifyGradingCompletedAsync(studentResult.Id, rubric.CreatedBy);

            // 🔥 BƯỚC 4: NÉM VÀO QUEUE CHO WORKER LÀM VIỆC NẶNG
            string rubricJson = JsonSerializer.Serialize(rubric);

            await _taskQueue.QueueBackgroundWorkItemAsync(new GradingTaskPayload
            {
                ResultId = studentResult.Id,
                ExtractedText = extractedText,
                ImageUrl = fileUrl,
                RubricJson = rubricJson,
                StudentCode = studentResult.StudentCode, // Truyền Mã xuống Worker
                StudentName = studentResult.StudentName  // Truyền Tên xuống Worker
            });

            await _notificationService.NotifyQueueUpdateAsync(_taskQueue.GetPendingCount());

            return new AIGradingResult
            {
                Id = studentResult.Id,
                TotalScore = 0,
                OverallFeedback = "Đã đưa vào hàng đợi chờ AI phân tích. Vui lòng kiểm tra Lịch sử chấm bài sau ít phút.",
                Details = new List<GradingDetailDto>()
            };
        }

        // =================================================================
        // 4. LUỒNG CŨ: THI ONLINE TRỰC TIẾP TRÊN WEB
        // =================================================================
        public async Task<AIGradingResult> ProcessOnlineSubmissionAsync(OnlineSubmissionDto request)
        {
            var rubric = await _rubricRepo.GetByIdAsync(request.TestId);
            if (rubric == null) throw new Exception("Không tìm thấy bộ đề thi trong hệ thống.");

            var allStudents = await _studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == request.StudentCode.Trim().ToLower());
            string exactStudentName = student != null ? student.FullName : request.StudentCode;

            double totalScore = 0;
            var gradingDetails = new List<GradingDetailDto>();

            if (request.Answers != null)
            {
                foreach (var question in rubric.Questions)
                {
                    // ĐÃ FIX LỖI ÉP KIỂU
                    string studentAns = request.Answers.ContainsKey(question.Order)
                              ? request.Answers[question.Order] : "";

                    bool isCorrect = string.Equals(studentAns.Trim(), question.CorrectAnswer.Trim(), StringComparison.OrdinalIgnoreCase);
                    double scoreForQuestion = isCorrect ? question.MaxScore : 0;
                    totalScore += scoreForQuestion;

                    gradingDetails.Add(new GradingDetailDto
                    {
                        QuestionNumber = question.Order,
                        RecognizedText = studentAns,
                        AwardedScore = scoreForQuestion,
                        AIFeedback = isCorrect
                            ? $"Chính xác. Đáp án chuẩn: {question.CorrectAnswer}."
                            : $"Sai. Đáp án chuẩn là: {question.CorrectAnswer}."
                    });
                }
            }

            var finalResult = new AIGradingResult
            {
                TotalScore = totalScore,
                OverallFeedback = $"Đã chấm xong bài thi trực tuyến. Đạt {totalScore} điểm.",
                Details = gradingDetails
            };

            var studentResult = new StudentResult
            {
                TestId = request.TestId,
                CreatedBy = rubric.CreatedBy, // 🔥 ĐÃ SỬA
                StudentCode = request.StudentCode,
                StudentName = exactStudentName,
                PaperImageUrl = "💻 Thi Trực Tuyến (Online Exam)",
                TotalScore = finalResult.TotalScore,
                GradedAt = DateTime.UtcNow,
                GradingDetails = gradingDetails.Select(d => new GradingDetail
                {
                    QuestionNumber = d.QuestionNumber,
                    RecognizedText = d.RecognizedText,
                    AwardedScore = d.AwardedScore,
                    AIFeedback = d.AIFeedback,
                    FinalScore = d.AwardedScore,
                    TeacherCorrection = "",
                    IsTeacherModified = false
                }).ToList()
            };

            await _studentResultRepo.CreateAsync(studentResult);
            // 🔥 ĐÃ SỬA
            await _notificationService.NotifyGradingCompletedAsync(studentResult.Id, rubric.CreatedBy);

            return finalResult;
        }

        // =================================================================
        // HÀM HELPER: RÚT CHỮ TỪ FILE WORD (.DOCX) - ĐÃ FIX ĐỌC THEO PARAGRAPH
        // =================================================================
        private string ExtractTextFromWord(Microsoft.AspNetCore.Http.IFormFile file)
        {
            try
            {
                using var memoryStream = new MemoryStream();
                file.CopyTo(memoryStream);
                memoryStream.Position = 0;

                using var wordDocument = WordprocessingDocument.Open(memoryStream, false);
                var body = wordDocument.MainDocumentPart?.Document.Body;
                if (body == null) return string.Empty;

                var sb = new StringBuilder();
                foreach (var paragraph in body.Descendants<DocumentFormat.OpenXml.Wordprocessing.Paragraph>())
                {
                    if (!string.IsNullOrWhiteSpace(paragraph.InnerText))
                    {
                        sb.AppendLine(paragraph.InnerText);
                    }
                }
                return sb.ToString();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[LỖI] Không thể đọc file Word: {ex.Message}");
                return string.Empty;
            }
        }
    }
}