using AutoGrader.Application.Interfaces;
using AutoGrader.Infrastructure.Data;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Repositories
{
    public class MongoRepository<T> : IRepository<T> where T : class
    {
        private readonly IMongoCollection<T> _collection;

        public MongoRepository(IOptions<MongoDbSettings> mongoDbSettings)
        {
            var mongoClient = new MongoClient(mongoDbSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(mongoDbSettings.Value.DatabaseName);

            _collection = mongoDatabase.GetCollection<T>(typeof(T).Name);
        }

        public async Task<IEnumerable<T>> GetAllAsync()
        {
            return await _collection.Find(_ => true).ToListAsync();
        }

        public async Task<T> GetByIdAsync(string id)
        {
            var filter = Builders<T>.Filter.Eq("Id", id);
            return await _collection.Find(filter).FirstOrDefaultAsync();
        }

        public async Task CreateAsync(T entity) =>
            await _collection.InsertOneAsync(entity);

        public async Task UpdateAsync(string id, T entity)
        {
            var filter = Builders<T>.Filter.Eq("Id", id);
            await _collection.ReplaceOneAsync(filter, entity);
        }

        public async Task DeleteAsync(string id)
        {
            var filter = Builders<T>.Filter.Eq("Id", id);
            await _collection.DeleteOneAsync(filter);
        }
        public async Task<(IEnumerable<T> Data, long TotalCount)> GetPagedAsync(int page, int pageSize, Expression<Func<T, bool>> filter = null)
        {
            // 1. Tạo điều kiện lọc (Nếu không truyền gì thì lấy tất cả)
            var filterDefinition = filter != null ? Builders<T>.Filter.Where(filter) : Builders<T>.Filter.Empty;

            // 2. Đếm tổng số bản ghi thỏa mãn điều kiện (để Frontend biết có bao nhiêu trang)
            var totalCount = await _collection.CountDocumentsAsync(filterDefinition);

            // 3. Bỏ qua các bản ghi cũ (Skip) và lấy số lượng giới hạn (Limit)
            var data = await _collection.Find(filterDefinition)
                                        .Skip((page - 1) * pageSize)
                                        .Limit(pageSize)
                                        .ToListAsync();

            return (data, totalCount);
        }
    }
}