using AutoGrader.Domain.Entities;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AutoGrader.Domain.Entities
{
    public class CorrectionRule
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }
        public string UserRule { get; set; } // Ngôn ngữ tự nhiên: "Chữ xấu quá cho 0đ"
        public string TargetScenario { get; set; } // Ngữ cảnh: "Spam chữ / OCR hỏng"
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}