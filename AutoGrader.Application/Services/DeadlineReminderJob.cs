using System;
using System.Threading.Tasks;
using System.Linq;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;

namespace AutoGrader.Application.Services
{
    public class DeadlineReminderJob
    {
        private readonly IRepository<Test> _testRepo;
        private readonly IRepository<Student> _studentRepo;
        private readonly IRepository<StudentResult> _resultRepo;
        private readonly IExpoNotificationService _notificationService;

        public DeadlineReminderJob(
            IRepository<Test> testRepo,
            IRepository<Student> studentRepo,
            IRepository<StudentResult> resultRepo,
            IExpoNotificationService notificationService)
        {
            _testRepo = testRepo;
            _studentRepo = studentRepo;
            _resultRepo = resultRepo;
            _notificationService = notificationService;
        }

        public async Task ScanAndWarnLazyStudentsAsync()
        {
            var now = DateTime.UtcNow;
            var warningTime = now.AddHours(2);

            var urgentTests = await _testRepo.FindAsync(t => t.Deadline > now && t.Deadline <= warningTime);

            foreach (var test in urgentTests)
            {
                // Bảng Test của bạn không có ClassId. Do đó, chúng ta sẽ lọc học sinh dựa trên CreatedBy 
                // (giả định Giáo viên tạo Test cũng là Giáo viên tạo Học sinh của lớp đó)
                var studentsInClass = await _studentRepo.FindAsync(s => s.CreatedBy == test.CreatedBy);

                // Lưu ý: Code này so sánh mã học sinh (StudentCode) thay vì ID
                var submittedStudentCodes = (await _resultRepo.FindAsync(r => r.TestId == test.Id))
                                          .Select(r => r.StudentCode).ToList();

                foreach (var student in studentsInClass)
                {
                    if (!submittedStudentCodes.Contains(student.StudentCode))
                    {
                        string title = "⚠️ Khẩn cấp: Hạn chót cận kề!";
                        // Sửa test.SubjectName thành test.Title
                        string body = $"Bạn chưa nộp bài kiểm tra {test.Title}. Hạn chót là 2 tiếng nữa!";

                        // Entity Student của bạn hiện chưa có DeviceToken. 
                        // Tạm thời tôi đặt ở đây để bạn bổ sung sau, hoặc lấy từ bảng User nếu hệ thống thiết kế tách biệt.
                        // string deviceToken = ... (Lấy token từ đâu đó);
                        string deviceToken = "TokenCuaHocSinh";

                        if (!string.IsNullOrEmpty(deviceToken))
                        {
                            await _notificationService.SendPushNotificationAsync(deviceToken, title, body);
                        }
                    }
                }
            }
        }
    }
}