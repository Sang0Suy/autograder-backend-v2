using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text;
using System.Threading.Tasks;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.AspNetCore.Http;
using ExcelDataReader; // 🔥 Đã thêm thư viện đọc Excel
using UglyToad.PdfPig;

namespace AutoGrader.Infrastructure.Services
{
    public interface IFileExtractionService
    {
        Task<string> ExtractTextAsync(IFormFile file);
    }

    public class FileExtractionService : IFileExtractionService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _ocrApiKey = "helloworld";

        // 🔥 Khởi tạo tĩnh cho việc hỗ trợ Encoding (Cần cho thư viện ExcelDataReader trên .NET Core)
        static FileExtractionService()
        {
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
        }

        public FileExtractionService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<string> ExtractTextAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return "Bỏ trống";

            var extension = Path.GetExtension(file.FileName).ToLower();

            switch (extension)
            {
                case ".txt":
                case ".json":
                    using (var reader = new StreamReader(file.OpenReadStream()))
                    {
                        return await reader.ReadToEndAsync();
                    }

                case ".docx":
                    return ExtractTextFromWord(file.OpenReadStream());

                // 🔥 Đã MỞ KHÓA định dạng Excel
                case ".xls":
                case ".xlsx":
                    return ExtractTextFromExcel(file.OpenReadStream());

                // 🔥 Luồng đọc PDF/Ảnh qua OCR
                case ".pdf":
                    return ExtractTextFromPdf(file.OpenReadStream()); // Gọi hàm đọc PDF nội bộ mới                case ".jpg":
                case ".jpeg":
                case ".png":
                    return await ExtractTextFromImageAndPdfViaOcrAsync(file);

                default:
                    // Câu báo lỗi quen thuộc của bạn vẫn nằm đây để chặn các file rác khác (.exe, .zip...)
                    throw new Exception($"Hệ thống chưa hỗ trợ định dạng file: {extension}. Vui lòng dùng Ảnh, PDF, Word, Excel hoặc TXT.");
            }
        }

        // 🔥 HÀM MỚI: Đọc văn bản từ file Excel (.xlsx / .xls)
        private string ExtractTextFromExcel(Stream stream)
        {
            try
            {
                var sb = new StringBuilder();

                using (var reader = ExcelReaderFactory.CreateReader(stream))
                {
                    // Lặp qua tất cả các Sheet trong file Excel
                    do
                    {
                        sb.AppendLine($"--- Sheet: {reader.Name} ---");

                        // Lặp qua từng dòng (Row)
                        while (reader.Read())
                        {
                            // Lặp qua từng cột (Column) trong dòng đó
                            for (int i = 0; i < reader.FieldCount; i++)
                            {
                                var cellValue = reader.GetValue(i);
                                if (cellValue != null && !string.IsNullOrWhiteSpace(cellValue.ToString()))
                                {
                                    sb.Append(cellValue.ToString().Trim() + " | "); // Ghép các ô bằng dấu |
                                }
                            }
                            sb.AppendLine(); // Xuống dòng khi hết 1 row
                        }
                        sb.AppendLine();
                    } while (reader.NextResult());
                }

                var result = sb.ToString().Trim();
                return string.IsNullOrEmpty(result) ? "Không tìm thấy dữ liệu chữ trong file Excel này." : result;
            }
            catch (Exception ex)
            {
                throw new Exception($"Lỗi khi bóc tách file Excel: {ex.Message}");
            }
        }

        // Đọc văn bản từ file Microsoft Word (.docx)
        private string ExtractTextFromWord(Stream stream)
        {
            try
            {
                using (WordprocessingDocument wordDoc = WordprocessingDocument.Open(stream, false))
                {
                    var body = wordDoc.MainDocumentPart?.Document?.Body;
                    return body?.InnerText ?? "Không tìm thấy chữ trong file Word này.";
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Lỗi khi bóc tách file Word: {ex.Message}");
            }
        }

        // Luồng OCR xử lý Ảnh và PDF Siêu an toàn
        private async Task<string> ExtractTextFromImageAndPdfViaOcrAsync(IFormFile file)
        {
            var client = _httpClientFactory.CreateClient("OcrClient");
            using var content = new MultipartFormDataContent();
            using var stream = file.OpenReadStream();

            content.Add(new StreamContent(stream), "file", file.FileName);
            content.Add(new StringContent(_ocrApiKey), "apikey");
            content.Add(new StringContent("vie"), "language");
            content.Add(new StringContent("true"), "scale");
            content.Add(new StringContent("true"), "isTable");

            try
            {
                var response = await client.PostAsync("https://api.ocr.space/parse/image", content);
                var jsonResult = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"Dịch vụ OCR từ chối kết nối (Lỗi {response.StatusCode}). Có thể API Key 'helloworld' đã bị quá tải.");
                }

                using var document = JsonDocument.Parse(jsonResult);
                var root = document.RootElement;

                if (root.TryGetProperty("IsErroredOnProcessing", out var isErrored) && isErrored.GetBoolean())
                {
                    string errorMessage = "Lỗi không xác định từ máy chủ OCR";
                    if (root.TryGetProperty("ErrorMessage", out var errorElement))
                    {
                        errorMessage = errorElement.ValueKind == JsonValueKind.Array
                                       ? errorElement[0].GetString()
                                       : errorElement.GetString();
                    }
                    throw new Exception($"OCR Space từ chối file: {errorMessage}");
                }

                if (root.TryGetProperty("ParsedResults", out var parsedResults) && parsedResults.GetArrayLength() > 0)
                {
                    var parsedText = parsedResults[0].GetProperty("ParsedText").GetString();
                    if (string.IsNullOrWhiteSpace(parsedText)) return "Bỏ trống";
                    return parsedText;
                }

                return "Không tìm thấy bất kỳ chữ nào trong tài liệu này.";
            }
            catch (JsonException)
            {
                throw new Exception("Hệ thống OCR trả về dữ liệu rác thay vì JSON. API Key có thể đã bị khóa.");
            }
        }
        // 2. Thêm hàm mới này vào dưới cùng của class FileExtractionService
        private string ExtractTextFromPdf(Stream stream)
        {
            try
            {
                using (PdfDocument document = PdfDocument.Open(stream))
                {
                    var sb = new StringBuilder();
                    // Lặp qua từng trang để lấy chữ
                    foreach (var page in document.GetPages())
                    {
                        sb.AppendLine(page.Text);
                    }
                    string result = sb.ToString().Trim();
                    return string.IsNullOrEmpty(result) ? "Không tìm thấy chữ trong file PDF này (có thể đây là file ảnh scan)." : result;
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Lỗi khi đọc file PDF: {ex.Message}");
            }
        }
    }
}