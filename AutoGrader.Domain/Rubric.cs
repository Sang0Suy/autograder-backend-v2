using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;
using System.Linq;

namespace AutoGrader.Domain.Entities
{
    public class QuestionItem
    {
        public int Order { get; set; }
        public string QuestionType { get; set; } = "Essay";
        public string Content { get; set; } = string.Empty;
        public string Options { get; set; } = string.Empty;
        public string CorrectAnswer { get; set; } = string.Empty;
        public double MaxScore { get; set; }
        public string Explanation { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new List<string>();
        public string Difficulty { get; set; } = "Nhận biết";
    }

    [BsonIgnoreExtraElements]
    public class Rubric
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;
        public string ExamType { get; set; } = string.Empty;

        public List<QuestionItem> Questions { get; set; } = new List<QuestionItem>();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonIgnore]
        public double TotalScore => Questions.Sum(q => q.MaxScore);

        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public int? MaxAttempts { get; set; }

        // 🔥 CHÌA KHÓA CÁCH LY DỮ LIỆU
        public string CreatedBy { get; set; } = string.Empty; // Sẽ lưu Username của giáo viên
        [BsonRepresentation(BsonType.ObjectId)]
        public string? ParentId { get; set; } = null;
    }
}