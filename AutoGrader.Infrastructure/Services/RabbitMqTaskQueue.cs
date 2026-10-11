using AutoGrader.Application.DTOs;
using AutoGrader.Application.Interfaces;
using RabbitMQ.Client;
using System;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class RabbitMqTaskQueue : IGradingTaskQueue
    {
        // Đọc URL từ biến môi trường, nếu không có thì mặc định dùng localhost
        private readonly string _rabbitMqUrl = Environment.GetEnvironmentVariable("RABBITMQ_URL") ?? "amqp://localhost:5672";
        private readonly string _queueName = "AIGradingQueue";

        public async ValueTask QueueBackgroundWorkItemAsync(GradingTaskPayload workItem)
        {
            var factory = new ConnectionFactory() { Uri = new Uri(_rabbitMqUrl) }; // Dùng Uri thay vì HostName

            using var connection = await factory.CreateConnectionAsync();
            using var channel = await connection.CreateChannelAsync();

            await channel.QueueDeclareAsync(queue: _queueName, durable: true, exclusive: false, autoDelete: false, arguments: null);

            var message = JsonSerializer.Serialize(workItem);
            var body = Encoding.UTF8.GetBytes(message);

            var properties = new BasicProperties { Persistent = true };

            await channel.BasicPublishAsync(exchange: "", routingKey: _queueName, mandatory: false, basicProperties: properties, body: body);
        }

        public ValueTask<GradingTaskPayload> DequeueAsync(CancellationToken cancellationToken)
        {
            throw new System.NotImplementedException("Hệ thống đã nâng cấp lên RabbitMQ (Push Event). Không dùng vòng lặp DequeueAsync nữa.");
        }

        public int GetPendingCount()
        {
            try
            {
                var factory = new ConnectionFactory() { Uri = new Uri(_rabbitMqUrl) };

                using var connection = factory.CreateConnectionAsync().GetAwaiter().GetResult();
                using var channel = connection.CreateChannelAsync().GetAwaiter().GetResult();

                var queueInfo = channel.QueueDeclarePassiveAsync(_queueName).GetAwaiter().GetResult();
                return (int)queueInfo.MessageCount;
            }
            catch
            {
                return 0;
            }
        }
    }
}