using AutoGrader.Application.Interfaces;
using AutoGrader.Domain;
using Microsoft.AspNetCore.Mvc;

namespace AutoGrader.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly IRepository<SystemStat> _statRepository;

        public StatsController(IRepository<SystemStat> statRepository)
        {
            _statRepository = statRepository;
        }

        [HttpGet("visit")]
        public async Task<IActionResult> IncrementAndGetVisits()
        {
            var stats = await _statRepository.GetAllAsync();
            var stat = stats.FirstOrDefault();

            if (stat == null)
            {
                stat = new SystemStat { TotalVisits = 12458 };
                await _statRepository.CreateAsync(stat);
            }
            else
            {
                stat.TotalVisits++;
                await _statRepository.UpdateAsync(stat.Id!, stat);
            }

            return Ok(new { totalVisits = stat.TotalVisits });
        }
    }
}