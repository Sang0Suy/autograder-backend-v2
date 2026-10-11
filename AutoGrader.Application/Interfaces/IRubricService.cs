using AutoGrader.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IRubricService
    {
        Task<IEnumerable<Rubric>> GetAllRubricsAsync();

        Task<Rubric> GetRubricByIdAsync(string id);

        // Đã bỏ hàm GetRubricsByTestIdAsync vì Rubric chứa sẵn Questions rồi

        Task<Rubric> CreateRubricAsync(Rubric rubric);

        Task UpdateRubricAsync(string id, Rubric rubric);

        Task DeleteRubricAsync(string id);
    }
}