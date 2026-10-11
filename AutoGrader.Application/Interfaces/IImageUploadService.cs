using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace AutoGrader.Application.Interfaces
{
    public interface IImageUploadService
    {
        Task<string> UploadImageAsync(IFormFile file);
    }
}