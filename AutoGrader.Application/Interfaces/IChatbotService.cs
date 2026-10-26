using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IChatbotService
    {
        Task<string> AskAssistantAsync(string userMessage);
    }
}