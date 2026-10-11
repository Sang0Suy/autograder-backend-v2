using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IRepository<T> where T : class
    {
        Task<IEnumerable<T>> GetAllAsync();
        Task<T> GetByIdAsync(string id);
        Task CreateAsync(T entity);
        Task UpdateAsync(string id, T entity);
        Task DeleteAsync(string id);
        Task<(IEnumerable<T> Data, long TotalCount)> GetPagedAsync(int page, int pageSize, Expression<Func<T, bool>> filter = null);
    }
}