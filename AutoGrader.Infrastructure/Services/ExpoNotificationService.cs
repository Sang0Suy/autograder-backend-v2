using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using AutoGrader.Application.Interfaces; // Lấy Interface từ tầng Application

namespace AutoGrader.Infrastructure.Services
{
    // Class thực thi vẫn nằm ở tầng vỏ
    public class ExpoNotificationService : IExpoNotificationService
    {
        private readonly HttpClient _httpClient;

        public ExpoNotificationService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task SendPushNotificationAsync(string expoPushToken, string title, string body)
        {
            var message = new
            {
                to = expoPushToken,
                sound = "default",
                title = title,
                body = body,
                data = new { action = "OPEN_RESULT_PAGE", testId = "123" }
            };

            var jsonMessage = JsonSerializer.Serialize(message);
            var content = new StringContent(jsonMessage, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("https://exp.host/--/api/v2/push/send", content);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                System.Console.WriteLine($"[Lỗi gửi Push Notification]: {error}");
            }
        }
    }
}