using AutoGrader.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class OcrSpaceService : IOcrService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _apiKey;

        public OcrSpaceService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _apiKey = configuration["OcrSpace:ApiKey"];
        }

        public async Task<string> ExtractTextFromImageAsync(Stream imageStream)
        {
            var client = _httpClientFactory.CreateClient("OcrClient");

            // 🔥 BƯỚC ĐỘT PHÁ Ở ĐÂY:
            // Chép "ly nước" (Stream) ra một cái "xô" (MemoryStream) rồi đúc thành cục đá (Byte Array).
            // Như vậy Polly có thể ném cục đá này đi bao nhiêu lần cũng không sợ bị "cạn" nữa!
            using var memoryStream = new MemoryStream();
            await imageStream.CopyToAsync(memoryStream);
            var imageBytes = memoryStream.ToArray();

            using var content = new MultipartFormDataContent();
            content.Add(new StringContent(_apiKey ?? ""), "apikey");
            content.Add(new StringContent("auto"), "language");
            content.Add(new StringContent("3"), "OCREngine");
            content.Add(new StringContent("true"), "isTable");

            // 🔥 Dùng ByteArrayContent thay vì StreamContent
            var imageContent = new ByteArrayContent(imageBytes);
            content.Add(imageContent, "file", "upload.jpg");

            // Gửi đi! Bị 504 thì Polly sẽ lấy nguyên cục mảng Byte này gửi lại ngon ơ!
            var response = await client.PostAsync("https://api.ocr.space/parse/image", content);
            response.EnsureSuccessStatusCode();

            var responseString = await response.Content.ReadAsStringAsync();
            using var document = JsonDocument.Parse(responseString);

            if (document.RootElement.TryGetProperty("IsErroredOnProcessing", out var isErrored) && isErrored.GetBoolean())
            {
                var errorMessage = document.RootElement.GetProperty("ErrorMessage")[0].GetString();
                throw new System.Exception($"Lỗi từ Server OCR.space: {errorMessage}");
            }

            if (document.RootElement.TryGetProperty("ParsedResults", out var parsedResults) && parsedResults.GetArrayLength() > 0)
            {
                return parsedResults[0].GetProperty("ParsedText").GetString();
            }

            return string.Empty;
        }
    }
}