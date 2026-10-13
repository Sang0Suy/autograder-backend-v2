using AutoGrader.Application.DTOs;
using AutoGrader.Domain.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IAIGradingService
    {
        // 🔥 Thêm CancellationToken vào cuối hàm
        Task<AIGradingResult> GradeAnswerAsync(string studentAnswer, string rubricContext, string imageUrl, string rubricId, CancellationToken cancellationToken = default);
        Task<string> ExtractRubricFromTextAsync(string rawText, CancellationToken cancellationToken = default);
        Task<Rubric> GenerateRubricFromImageAsync(string answerKeyImageUrl);
    }
}