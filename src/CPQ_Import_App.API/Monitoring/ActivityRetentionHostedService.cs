using CPQ_Import_App.Infrastructure.Services;
using Microsoft.Extensions.Options;

namespace CPQ_Import_App.API.Monitoring;

public class ActivityRetentionHostedService(
    IServiceProvider serviceProvider,
    IOptions<AppActivityTrackingOptions> options,
    ILogger<ActivityRetentionHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var config = options.Value;
        if (!config.Enabled)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = serviceProvider.CreateScope();
                var activityService = scope.ServiceProvider.GetRequiredService<IActivityService>();
                var removed = await activityService.CleanupOlderThanAsync(config.RetentionDays, stoppingToken);

                if (removed > 0)
                {
                    logger.LogInformation("Activity retention removed {Count} old events.", removed);
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Activity retention cleanup run failed.");
            }

            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }
}
