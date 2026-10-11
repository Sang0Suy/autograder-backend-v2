using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AutoGrader.Domain.Entities
{
    public class User
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("username")]
        public string Username { get; set; } = null!;

        [BsonElement("passwordHash")]
        public string PasswordHash { get; set; } = null!; // Mật khẩu đã mã hóa

        [BsonElement("fullName")]
        public string FullName { get; set; } = null!;

        [BsonElement("role")]
        public string Role { get; set; } = null!; // Lưu: "Admin", "Teacher", hoặc "Student"

        [BsonElement("referenceId")]
        public string? ReferenceId { get; set; } // Nếu là Student, lưu Id của bảng Học Sinh để đối chiếu dữ liệu điểm
        public List<string> AllowedClasses { get; set; } = new List<string>();
    }
}