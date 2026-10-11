using AutoGrader.Application.Interfaces;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace AutoGrader.Infrastructure.Services
{
    public class CloudinaryService : IImageUploadService
    {
        private readonly Cloudinary _cloudinary;

        public CloudinaryService(IConfiguration config)
        {
            var account = new Account(
                config["Cloudinary:CloudName"],
                config["Cloudinary:ApiKey"],
                config["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
        }

        public async Task<string> UploadImageAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return "";

            using var stream = file.OpenReadStream();
            var extension = Path.GetExtension(file.FileName).ToLower();

            // 🔥 NẾU LÀ VĂN BẢN (WORD/TXT/PDF): Bắt buộc dùng RawUploadParams
            if (extension == ".doc" || extension == ".docx" || extension == ".txt" || extension == ".pdf")
            {
                var rawUploadParams = new RawUploadParams
                {
                    File = new FileDescription(file.FileName, stream)
                };
                var uploadResult = await _cloudinary.UploadAsync(rawUploadParams);

                if (uploadResult.Error != null) throw new System.Exception(uploadResult.Error.Message);
                return uploadResult.SecureUrl.ToString();
            }
            // 🖼️ NẾU LÀ ẢNH: Dùng ImageUploadParams như cũ
            else
            {
                var imageUploadParams = new ImageUploadParams
                {
                    File = new FileDescription(file.FileName, stream)
                };
                var uploadResult = await _cloudinary.UploadAsync(imageUploadParams);

                if (uploadResult.Error != null) throw new System.Exception(uploadResult.Error.Message);
                return uploadResult.SecureUrl.ToString();
            }
        }
    }
}