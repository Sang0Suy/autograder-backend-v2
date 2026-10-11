using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AutoGrader.Application.Services
{
    public class TestService : ITestService
    {
        private readonly IRepository<Test> _testRepository;

        // Tiêm (Inject) Generic Repository vào Service
        public TestService(IRepository<Test> testRepository)
        {
            _testRepository = testRepository;
        }

        public async Task<IEnumerable<Test>> GetAllTestsAsync()
        {
            return await _testRepository.GetAllAsync();
        }

        public async Task<Test> GetTestByIdAsync(string id)
        {
            return await _testRepository.GetByIdAsync(id);
        }

        public async Task<Test> CreateTestAsync(Test test)
        {
            // Business Logic: Tự động gán thời gian tạo trước khi lưu xuống DB
            test.CreatedAt = DateTime.UtcNow;

            // Nếu bạn muốn validate dữ liệu (vd: Test.Title không được để trống), bạn cũng sẽ viết ở đây

            await _testRepository.CreateAsync(test);
            return test; // Trả về test để lấy được Id do MongoDB tự sinh ra
        }

        public async Task UpdateTestAsync(string id, Test test)
        {
            await _testRepository.UpdateAsync(id, test);
        }

        public async Task DeleteTestAsync(string id)
        {
            await _testRepository.DeleteAsync(id);
        }
    }
}