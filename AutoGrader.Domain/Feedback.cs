using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AutoGrader.Domain
{
    public class Feedback
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int Rating { get; set; } = 5;

        // Cờ này để Admin duyệt thì mới được hiện lên trang chủ
        public bool IsApproved { get; set; } = true;
    }
}