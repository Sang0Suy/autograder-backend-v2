using AutoGrader.Application.DTOs;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IGradingWorkflowService
    {
        // Hàm nhận vào file ảnh và dữ liệu barem, điều phối qua OCR và AI để trả về kết quả chấm
        Task<AIGradingResult> ProcessSubmissionAsync(StudentSubmissionDto request);
        Task<AIGradingResult> ProcessOmrSubmissionAsync(StudentSubmissionDto request);
        Task<AIGradingResult> ProcessAiSubmissionAsync(StudentSubmissionDto request);
        Task<AIGradingResult> ProcessOnlineSubmissionAsync(OnlineSubmissionDto request);
    }
}