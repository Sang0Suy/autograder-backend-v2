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
        public string PasswordHash { get; set; } = null!;

        [BsonElement("fullName")]
        public string FullName { get; set; } = null!;

        [BsonElement("email")]
        public string? Email { get; set; } = string.Empty;

        [BsonElement("phone")]
        public string? Phone { get; set; } = string.Empty;

        [BsonElement("role")]
        public string Role { get; set; } = null!;

        [BsonElement("referenceId")]
        public string? ReferenceId { get; set; }

        public List<string> AllowedClasses { get; set; } = new List<string>();
    }
}