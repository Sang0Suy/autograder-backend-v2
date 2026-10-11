using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using System;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class GradingTaskQueue : IGradingTaskQueue
    {
        private readonly Channel<GradingTaskPayload> _queue;

        public GradingTaskQueue()
        {
            var options = new BoundedChannelOptions(1000)
            {
                FullMode = BoundedChannelFullMode.Wait
            };
            _queue = Channel.CreateBounded<GradingTaskPayload>(options);
        }

        public async ValueTask QueueBackgroundWorkItemAsync(GradingTaskPayload workItem)
        {
            if (workItem == null) throw new ArgumentNullException(nameof(workItem));
            await _queue.Writer.WriteAsync(workItem);
        }

        public async ValueTask<GradingTaskPayload> DequeueAsync(CancellationToken cancellationToken)
        {
            var workItem = await _queue.Reader.ReadAsync(cancellationToken);
            return workItem;
        }

        // 🔥 MỚI: Trả về số lượng công việc đang xếp hàng
        public int GetPendingCount()
        {
            // CanCount kiểm tra xem Channel này có hỗ trợ đếm không, nếu có thì trả về Count
            return _queue.Reader.CanCount ? _queue.Reader.Count : 0;
        }
    }
}