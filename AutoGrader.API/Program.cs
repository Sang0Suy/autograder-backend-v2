using AutoGrader.Application.Interfaces;
using AutoGrader.Application.Services;
using AutoGrader.Domain.Entities;
using AutoGrader.Infrastructure.Data;
using AutoGrader.Infrastructure.Repositories;
using AutoGrader.Infrastructure.Services;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.Tokens;
using Microsoft.SemanticKernel;
using Polly;
using Polly.Extensions.Http;
using System.Net;
using System.Net.Http;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var jwtSettings = builder.Configuration.GetSection("Jwt");
var key = Encoding.ASCII.GetBytes(jwtSettings["Key"]!);

// Hàm chiến thuật: Bị mắng thì lùi lại, không được bỏ cuộc!
static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError() // Tự động bắt lỗi sập Server (5xx) và Đứt mạng (408 Timeout)
        .OrResult(msg => msg.StatusCode == HttpStatusCode.TooManyRequests) // 🔥 BẮT BUỘC CÓ: Chặn đầu lỗi 429 của Google!
        .WaitAndRetryAsync(
            retryCount: 4, // Cho phép lì lợm thử lại tối đa 4 lần
            sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)), // Nghỉ 2s, 4s, 8s, 16s
            onRetry: (outcome, timespan, retryAttempt, context) =>
            {
                // In ra cửa sổ đen (Console) để lúc bảo vệ đồ án, thầy cô thấy hệ thống đang tự "chữa lành"
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"[Polly Shield] Máy chủ (Google/OCR) đang quá tải! Lùi bước chờ {timespan.TotalSeconds}s để thử lại lần {retryAttempt}...");
                Console.ResetColor();
            });
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false; // Tắt lúc dev localhost
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // 🔥 THÊM ĐOẠN NÀY ĐỂ SIGNALR ĐỌC ĐƯỢC TOKEN
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/gradingHub"))
            {
                context.Token = accessToken; // Gắn token vào SignalR
            }
            return Task.CompletedTask;
        }
    };
});
// 1. Đăng ký Hangfire chạy trên RAM
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseInMemoryStorage());

// 2. Kích hoạt Background Server để xử lý hàng đợi
builder.Services.AddHangfireServer();
// 🔥 1. Đăng ký HttpClient gọi Gemini và gắn giáp Polly vào
builder.Services.AddHttpClient("GeminiClient", client =>
{
    client.Timeout = TimeSpan.FromMinutes(3); // Cho phép đợi 3 phút
})
.AddPolicyHandler(GetRetryPolicy());

// 🔥 2. Đăng ký HttpClient gọi OCR.Space và gắn giáp Polly vào
builder.Services.AddHttpClient("OcrClient", client =>
{
    client.Timeout = TimeSpan.FromMinutes(3); // Cho phép đợi 3 phút
})
.AddPolicyHandler(GetRetryPolicy());

// Add services to the container.
builder.Services.AddHttpClient(); // Để lại cái này cho các tác vụ download/upload lặt vặt
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();

// 1. Lấy cấu hình MongoDB từ appsettings.json
builder.Services.Configure<MongoDbSettings>(
    builder.Configuration.GetSection("MongoDbSettings"));

// 2. Đăng ký Generic Repository
builder.Services.AddScoped(typeof(IRepository<>), typeof(MongoRepository<>));

// 🔥 CẤU HÌNH CORS CHUẨN (Gộp chung Localhost và Vercel)
// 🔥 CẤU HÌNH CORS CHUẨN (Chấp nhận mọi Vercel và Localhost mà vẫn giữ được SignalR)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVercel", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // Bật đèn xanh cho TẤT CẢ các tên miền gọi tới
              .AllowAnyHeader()                   // Chấp nhận mọi loại Headers (như Authorization Token)
              .AllowAnyMethod()                   // Chấp nhận mọi Method (GET, POST, PUT, DELETE)
              .AllowCredentials();                // Giữ lại linh hồn cho SignalR hoạt động mượt mà
    });
});
builder.Services.AddKernel()
    .AddGoogleAIGeminiChatCompletion(
        modelId: "gemini-1.5-flash", // Hoặc gemini-1.5-pro tùy nhu cầu
        apiKey: builder.Configuration["AIKeys:Gemini"] // Lấy Key từ appsettings.json
    );
// 3. Đăng ký các Business Services
builder.Services.AddScoped<ITestService, TestService>();
builder.Services.AddScoped<IRepository<Rubric>, MongoRepository<Rubric>>();
builder.Services.AddScoped<IAIGradingService, GeminiGradingService>();
builder.Services.AddScoped<IOcrService, OcrSpaceService>();
builder.Services.AddScoped<IRubricService, RubricService>();
builder.Services.AddScoped<IGradingWorkflowService, GradingWorkflowService>();
builder.Services.AddScoped<IRepository<StudentResult>, MongoRepository<StudentResult>>();
builder.Services.AddScoped<IImageUploadService, CloudinaryService>();
builder.Services.AddScoped<IRepository<Student>, MongoRepository<Student>>();
builder.Services.AddScoped<IRepository<User>, MongoRepository<User>>();
builder.Services.AddScoped<IOmrScannerService, OmrScannerService>();
builder.Services.AddSingleton<IGradingTaskQueue, RabbitMqTaskQueue>(); 
builder.Services.AddHostedService<GradingBackgroundWorker>();
builder.Services.AddScoped<IFileExtractionService, FileExtractionService>();
builder.Services.AddSingleton<AutoGrader.Application.Interfaces.IGradingNotificationService, AutoGrader.API.Hubs.GradingNotificationService>();
builder.Services.AddSingleton<ITaskCancellationManager, TaskCancellationManager>();
builder.Services.AddScoped<IRepository<CorrectionRule>, MongoRepository<CorrectionRule>>();
builder.Services.AddScoped<IFileExtractionService, FileExtractionService>();
builder.Services.AddSingleton<IChatbotService, ChatbotService>();
builder.Services.AddTransient<BatchGradingJob>();
builder.Services.AddScoped<PlagiarismDetectionService>();
// 🔥 1. Sửa lại đăng ký gửi thông báo qua Interface (Dependency Inversion chuẩn)
builder.Services.AddHttpClient<IExpoNotificationService, ExpoNotificationService>();
builder.Services.AddTransient<DeadlineReminderJob>();
// 🔥 2. Đăng ký Job để Hangfire có thể tìm thấy và giao việc
builder.Services.AddTransient<GradingJob>();
var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// 🔥 SẮP XẾP LẠI THỨ TỰ MIDDLEWARE (Rất quan trọng)
app.UseRouting();
app.UseCors("AllowVercel");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<AutoGrader.API.Hubs.GradingHub>("/gradingHub");
app.UseHangfireDashboard("/hangfire");
using (var scope = app.Services.CreateScope())
{
    var recurringJobManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

    // Cú pháp Cron: "*/30 * * * *" nghĩa là chạy mỗi 30 phút. 
    // Nếu muốn test nhanh mỗi 1 phút thì dùng: "* * * * *"
    recurringJobManager.AddOrUpdate<AutoGrader.Application.Services.DeadlineReminderJob>(
        "lazy-student-scanner",
        job => job.ScanAndWarnLazyStudentsAsync(),
        "*/30 * * * *"
    );
}
app.Run();