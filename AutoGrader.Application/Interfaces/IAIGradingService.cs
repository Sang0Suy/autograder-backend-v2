using AutoGrader.Application.DTOs;
using System.Threading;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IAIGradingService
    {
        // 🔥 Thêm CancellationToken vào cuối hàm
        Task<AIGradingResult> GradeAnswerAsync(string studentAnswer, string rubricContext, CancellationToken cancellationToken = default);
        Task<string> ExtractRubricFromTextAsync(string rawText, CancellationToken cancellationToken = default);
    }
}