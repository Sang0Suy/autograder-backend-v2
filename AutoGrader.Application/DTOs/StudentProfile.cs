using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

public class StudentProfile
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string Id { get; set; }

    public string StudentCode { get; set; } // Mã học sinh (ví dụ: HS001)
    public string FullName { get; set; }

    // ĐIỂM KINH NGHIỆM & CẤP ĐỘ
    public int TotalXP { get; set; } = 0; // Tổng điểm kinh nghiệm
    public int Level { get; set; } = 1;   // Cấp độ hiện tại (Tăng khi đủ XP)
    public string CurrentRank { get; set; } = "Đồng"; // Rank (Đồng, Bạc, Vàng, Kim Cương...)

    // CHUỖI THÀNH TÍCH (Streak)
    public int CurrentStreak { get; set; } = 0; // Chuỗi ngày liên tiếp vào làm bài
    public int HighestScoreCount { get; set; } = 0; // Số lần đạt điểm tối đa
}