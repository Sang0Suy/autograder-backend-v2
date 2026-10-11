using AutoGrader.Application.Interfaces;
using AutoGrader.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AutoGrader.Application.Services
{
    public class RubricService : IRubricService
    {
        private readonly IRepository<Rubric> _rubricRepository;

        public RubricService(IRepository<Rubric> rubricRepository)
        {
            _rubricRepository = rubricRepository;
        }

        public async Task<IEnumerable<Rubric>> GetAllRubricsAsync()
        {
            var rubrics = await _rubricRepository.GetAllAsync();
            return rubrics.OrderByDescending(r => r.CreatedAt).ToList();
        }

        public async Task<Rubric> GetRubricByIdAsync(string id)
        {
            return await _rubricRepository.GetByIdAsync(id);
        }

        public async Task<Rubric> CreateRubricAsync(Rubric rubric)
        {
            // Thiết lập giá trị mặc định cho Đề thi mới
            rubric.Id = string.Empty;
            rubric.CreatedAt = DateTime.UtcNow;

            // MongoDB sẽ tự động lưu cả Đề thi lẫn mảng Questions bên trong
            await _rubricRepository.CreateAsync(rubric);
            return rubric;
        }

        public async Task UpdateRubricAsync(string id, Rubric rubric)
        {
            rubric.Id = id;
            await _rubricRepository.UpdateAsync(id, rubric);
        }

        public async Task DeleteRubricAsync(string id)
        {
            await _rubricRepository.DeleteAsync(id);
        }
    }
}