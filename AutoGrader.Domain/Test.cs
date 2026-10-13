using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace AutoGrader.Domain.Entities
{
    public class Test
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public List<string> RubricIds { get; set; } = new List<string>();
        public int TotalStudents { get; set; }
        public DateTime Deadline { get; set; }
        public string ClassId { get; set; } = string.Empty; // Để biết bài Test này giao cho lớp nào

        // 🔥 CHÌA KHÓA CÁCH LY DỮ LIỆU
        public string CreatedBy { get; set; } = string.Empty;
    }
}