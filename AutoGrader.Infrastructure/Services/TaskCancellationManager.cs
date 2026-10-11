using System.Collections.Concurrent;
using System.Threading;

namespace AutoGrader.Infrastructure.Services
{
    // Interface để tiêm vào Dependency Injection
    public interface ITaskCancellationManager
    {
        CancellationToken AddTask(string resultId);
        void CancelTask(string resultId);
        void RemoveTask(string resultId);
    }

    public class TaskCancellationManager : ITaskCancellationManager
    {
        // Cuốn sổ lưu trữ công tắc (Thread-safe)
        private readonly ConcurrentDictionary<string, CancellationTokenSource> _tokens = new();

        public CancellationToken AddTask(string resultId)
        {
            var cts = new CancellationTokenSource();
            _tokens.TryAdd(resultId, cts);
            return cts.Token; // Phát thẻ bài ra
        }

        public void CancelTask(string resultId)
        {
            if (_tokens.TryGetValue(resultId, out var cts))
            {
                cts.Cancel(); // 💥 GẠT CÔNG TẮC KÍCH NỔ
            }
        }

        public void RemoveTask(string resultId)
        {
            if (_tokens.TryRemove(resultId, out var cts))
            {
                cts.Dispose(); // Dọn dẹp RAM
            }
        }
    }
}