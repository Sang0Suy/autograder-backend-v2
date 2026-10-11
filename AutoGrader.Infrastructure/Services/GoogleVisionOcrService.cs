using AutoGrader.Application.Interfaces;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Vision.V1;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class GoogleVisionOcrService : IOcrService
    {
        private readonly string _credentialFilePath;

        public GoogleVisionOcrService(IConfiguration configuration)
        {
            // Lấy đường dẫn trỏ tới file JSON chứng chỉ từ appsettings
            _credentialFilePath = configuration["GoogleCloud:VisionCredentialPath"];
        }

        public async Task<string> ExtractTextFromImageAsync(Stream imageStream)
        {
            // 1. Xác thực bằng file JSON
            var credential = GoogleCredential.FromFile(_credentialFilePath);
            var clientBuilder = new ImageAnnotatorClientBuilder
            {
                Credential = credential
            };

            // 2. Tạo Client kết nối tới Google
            var client = await clientBuilder.BuildAsync();

            // 3. Đọc luồng ảnh
            var image = await Image.FromStreamAsync(imageStream);

            // 4. Gửi ảnh lên Google yêu cầu bóc tách chữ (Document Text Detection phù hợp cho chữ viết tay)
            var response = await client.DetectDocumentTextAsync(image);

            // 5. Trả về kết quả
            return response?.Text ?? string.Empty;
        }
    }
}