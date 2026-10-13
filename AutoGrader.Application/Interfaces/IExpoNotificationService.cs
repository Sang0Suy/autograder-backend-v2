using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    // Interface nằm ở tầng lõi, không chứa logic gọi API
    public interface IExpoNotificationService
    {
        Task SendPushNotificationAsync(string expoPushToken, string title, string body);
    }
}