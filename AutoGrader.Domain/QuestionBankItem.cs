using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace AutoGrader.Domain
{
    public class QuestionBankItem
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }

        public string Content { get; set; } // Nội dung câu hỏi

        // Trắc nghiệm (MultipleChoice) hoặc Tự luận (Essay)
        public string QuestionType { get; set; }

        // Mảng các đáp án (VD: ["Hà Nội", "Huế", "Đà Nẵng", "TP.HCM"]) - Chỉ dùng cho trắc nghiệm
        public List<string> Options { get; set; } = new List<string>();

        public string CorrectAnswer { get; set; } // Đáp án đúng (VD: "A" hoặc câu trả lời tự luận)

        public string Subject { get; set; } // Môn học (VD: "Toán", "Lịch Sử")
        public string Topic { get; set; } // Chủ đề (VD: "Đạo hàm", "Hình học không gian")

        // Phân loại độ khó: "Dễ", "Trung Bình", "Khó", "Cực Khó"
        public string DifficultyLevel { get; set; }

        public double DefaultScore { get; set; } = 1.0; // Điểm mặc định cho câu hỏi này

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}