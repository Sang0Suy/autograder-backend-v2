using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace AutoGrader.Domain
{
    public class SystemStat
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        // Mặc định cho một con số khởi điểm đẹp đẹp một chút
        public int TotalVisits { get; set; } = 12458;
    }
}