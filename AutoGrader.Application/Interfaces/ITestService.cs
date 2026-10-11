using AutoGrader.Domain.Entities;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface ITestService
    {
        Task<IEnumerable<Test>> GetAllTestsAsync();
        Task<Test> GetTestByIdAsync(string id);
        Task<Test> CreateTestAsync(Test test);
        Task UpdateTestAsync(string id, Test test);
        Task DeleteTestAsync(string id);
    }
}