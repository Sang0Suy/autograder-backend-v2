using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Collections.Generic;

namespace AutoGrader.Domain.Entities
{
    public class Student
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("studentCode")]
        public string StudentCode { get; set; } = null!;

        [BsonElement("fullName")]
        public string FullName { get; set; } = null!;

        [BsonElement("className")]
        public string ClassName { get; set; } = null!;
        public string ClassId { get; set; }
        public string? DeviceToken { get; set; } // Để Expo biết đường gửi thông báo tới điện thoại

        // 🔥 CHÌA KHÓA CÁCH LY DỮ LIỆU
        public string CreatedBy { get; set; } = string.Empty;

        [BsonExtraElements]
        public Dictionary<string, object> ExtraAttributes { get; set; } = new();
    }
}