using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class GradingBackgroundWorker : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<GradingBackgroundWorker> _logger;
        private readonly string _queueName = "AIGradingQueue";

        public GradingBackgroundWorker(IServiceProvider serviceProvider, ILogger<GradingBackgroundWorker> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🚀 Trạm công nhân AI (RabbitMQ v7.x) đã khởi động...");

            string rabbitMqUrl = Environment.GetEnvironmentVariable("RABBITMQ_URL") ?? "amqp://localhost:5672";
            var factory = new ConnectionFactory { Uri = new Uri(rabbitMqUrl) };

            // Dùng các hàm Async của RabbitMQ v7.x
            var connection = await factory.CreateConnectionAsync();
            var channel = await connection.CreateChannelAsync();

            await channel.QueueDeclareAsync(queue: _queueName, durable: true, exclusive: false, autoDelete: false, arguments: null);

            // QOS: Bắt worker chỉ lấy 1 bài ra chấm mỗi lần, chấm xong mới lấy tiếp (Tránh nghẽn CPU)
            await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false);

            var consumer = new AsyncEventingBasicConsumer(channel);

            // Sự kiện ReceivedAsync sẽ tự động kích hoạt khi có tin nhắn mới
            consumer.ReceivedAsync += async (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);
                var workItem = JsonSerializer.Deserialize<GradingTaskPayload>(message);

                try
                {
                    _logger.LogInformation($"[RABBITMQ WORKER] Đã rút bài {workItem.ResultId} khỏi hàng đợi. Bắt đầu xử lý...");

                    // 👉 GỌI LOGIC CHẤM BÀI CHÍNH
                    await ProcessGradingJobAsync(workItem, channel, stoppingToken);

                    // 🔥 THÀNH CÔNG -> Gửi cờ ACK (Acknowledge) báo RabbitMQ xóa tin nhắn đi
                    await channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false);
                    _logger.LogInformation($"[RABBITMQ WORKER] Đã gửi ACK cho bài {workItem.ResultId}. Hoàn thành!");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"[RABBITMQ WORKER] Lỗi chấm bài {workItem.ResultId}. Trả lại vào Queue để thử lại sau!");
                    // 🛑 THẤT BẠI -> Gửi cờ NACK (Negative Acknowledge) để đẩy bài trở lại hàng đợi, không bị mất bài!
                    await channel.BasicNackAsync(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true);
                }
            };

            // Bắt đầu lắng nghe
            await channel.BasicConsumeAsync(queue: _queueName, autoAck: false, consumer: consumer);

            // Giữ cho Background Worker luôn sống cho đến khi ứng dụng bị tắt
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }

            // Dọn dẹp khi tắt server
            await channel.CloseAsync();
            await connection.CloseAsync();
        }

        private async Task ProcessGradingJobAsync(GradingTaskPayload workItem, IChannel channel, CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var aiGradingService = scope.ServiceProvider.GetRequiredService<IAIGradingService>();
            var resultRepo = scope.ServiceProvider.GetRequiredService<IRepository<StudentResult>>();
            var studentRepo = scope.ServiceProvider.GetRequiredService<IRepository<Student>>();
            var rubricService = scope.ServiceProvider.GetRequiredService<IRubricService>();
            var cancelManager = scope.ServiceProvider.GetRequiredService<ITaskCancellationManager>();
            var notifier = scope.ServiceProvider.GetRequiredService<IGradingNotificationService>();
            var httpClientFactory = scope.ServiceProvider.GetRequiredService<IHttpClientFactory>();
            var ocrService = scope.ServiceProvider.GetRequiredService<IOcrService>();

            // Báo SignalR số lượng đang kẹt (Đếm trực tiếp từ RabbitMQ)
            var queueInfo = await channel.QueueDeclarePassiveAsync(_queueName);
            await notifier.NotifyQueueUpdateAsync((int)queueInfo.MessageCount);

            var jobToken = cancelManager.AddTask(workItem.ResultId);
            using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken, jobToken);

            string textForAI = workItem.ExtractedText;

            // 1. Quét OCR
            if (string.IsNullOrWhiteSpace(textForAI) && !string.IsNullOrWhiteSpace(workItem.ImageUrl))
            {
                var client = httpClientFactory.CreateClient();
                using var imageStream = await client.GetStreamAsync(workItem.ImageUrl, linkedCts.Token);
                textForAI = await ocrService.ExtractTextFromImageAsync(imageStream);

                if (string.IsNullOrWhiteSpace(textForAI)) throw new Exception("OCR không đọc được chữ nào!");
            }

            // 2. Gemini chấm
            // Giả định workItem có ImageUrl và RubricId. Nếu không có, bạn hãy dùng chuỗi rỗng ""
            var aiResult = await aiGradingService.GradeAnswerAsync(textForAI, workItem.RubricJson, workItem.ImageUrl ?? "", "", linkedCts.Token);
            // 3. Cập nhật DB
            var studentResult = await resultRepo.GetByIdAsync(workItem.ResultId);
            if (studentResult != null)
            {
                studentResult.TotalScore = aiResult.TotalScore;
                studentResult.PaperImageUrl = studentResult.PaperImageUrl.Replace("(Đang chờ AI chấm...)", "").Trim();

                if (!string.IsNullOrWhiteSpace(aiResult.StudentCode)) studentResult.StudentCode = aiResult.StudentCode.Trim();

                bool isAutoMode = workItem.StudentCode == "AUTO" || string.IsNullOrWhiteSpace(workItem.StudentCode);

                if (!isAutoMode)
                {
                    studentResult.StudentCode = workItem.StudentCode;
                    studentResult.StudentName = workItem.StudentName;
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(aiResult.StudentCode))
                    {
                        studentResult.StudentCode = aiResult.StudentCode.Trim();
                        var allStudents = await studentRepo.GetAllAsync();
                        var foundStudent = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == studentResult.StudentCode.ToLower());
                        if (foundStudent != null) studentResult.StudentName = foundStudent.FullName;
                        else studentResult.StudentName = !string.IsNullOrWhiteSpace(aiResult.StudentName) ? aiResult.StudentName.Trim() : studentResult.StudentCode;
                    }
                    else if (!string.IsNullOrWhiteSpace(aiResult.StudentName)) studentResult.StudentName = aiResult.StudentName.Trim();
                    else studentResult.StudentName = "Khách vãng lai";
                }

                studentResult.GradingDetails = aiResult.Details.Select(d => new GradingDetail
                {
                    QuestionNumber = d.QuestionNumber,
                    RecognizedText = d.RecognizedText,
                    AwardedScore = d.AwardedScore,
                    AIFeedback = d.AIFeedback,
                    FinalScore = d.AwardedScore,
                    TeacherCorrection = "",
                    IsTeacherModified = false
                }).ToList();

                await resultRepo.UpdateAsync(workItem.ResultId, studentResult);
                await SyncScoreToStudentDashboardAsync(studentResult, studentRepo, rubricService);

                // 4. Bắn SignalR
                await notifier.NotifyGradingCompletedAsync(studentResult.Id, studentResult.CreatedBy);
            }

            cancelManager.RemoveTask(workItem.ResultId);

            // Cập nhật lại số lượng hàng chờ sau khi xong 1 bài
            var afterQueueInfo = await channel.QueueDeclarePassiveAsync(_queueName);
            await notifier.NotifyQueueUpdateAsync((int)afterQueueInfo.MessageCount);
        }

        private async Task SyncScoreToStudentDashboardAsync(StudentResult studentResult, IRepository<Student> studentRepo, IRubricService rubricService)
        {
            if (string.IsNullOrEmpty(studentResult.StudentCode)) return;
            var allStudents = await studentRepo.GetAllAsync();
            var student = allStudents.FirstOrDefault(s => s.StudentCode.Trim().ToLower() == studentResult.StudentCode.Trim().ToLower());

            if (student != null)
            {
                if (student.ExtraAttributes == null) student.ExtraAttributes = new Dictionary<string, object>();

                string targetColumn = "Điểm Thi";
                if (!string.IsNullOrEmpty(studentResult.TestId))
                {
                    var rubric = await rubricService.GetRubricByIdAsync(studentResult.TestId);
                    if (rubric != null)
                    {
                        var titleLower = rubric.Title.ToLower();
                        if (titleLower.Contains("15p") || titleLower.Contains("15 phút")) targetColumn = "Điểm 15p";
                        else if (titleLower.Contains("45p") || titleLower.Contains("45 phút")) targetColumn = "Điểm 45p";
                        else if (titleLower.Contains("thường xuyên") || titleLower.Contains("tx")) targetColumn = "Điểm TX";
                    }
                }
                student.ExtraAttributes[targetColumn] = studentResult.TotalScore;
                await studentRepo.UpdateAsync(student.Id, student);
            }
        }
    }
}