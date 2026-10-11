using System.IO;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IOcrService
    {
        // Nhận vào một Stream (luồng dữ liệu ảnh) và trả về text đọc được
        Task<string> ExtractTextFromImageAsync(Stream imageStream);
    }
}