using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace AutoGrader.Domain.Entities
{
    [BsonIgnoreExtraElements]
    public class StudentResult
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } = string.Empty;

        [BsonRepresentation(BsonType.ObjectId)]
        public string TestId { get; set; } = string.Empty;
        public string StudentCode { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string PaperImageUrl { get; set; } = string.Empty;
        public double TotalScore { get; set; }

        // 🔥 CHÌA KHÓA CÁCH LY DỮ LIỆU
        public string CreatedBy { get; set; } = string.Empty;

        public List<GradingDetail> GradingDetails { get; set; } = new List<GradingDetail>();
        public DateTime GradedAt { get; set; } = DateTime.UtcNow;
        public string ContentHash { get; set; } = string.Empty;
    }
    [BsonIgnoreExtraElements]
    public class GradingDetail
    {
        public int QuestionNumber { get; set; }
        public string RecognizedText { get; set; } = string.Empty;
        public double AwardedScore { get; set; }
        public string AIFeedback { get; set; } = string.Empty;

        public double? FinalScore { get; set; }
        public string TeacherCorrection { get; set; } = string.Empty;
        public bool IsTeacherModified { get; set; } = false;
    }
}