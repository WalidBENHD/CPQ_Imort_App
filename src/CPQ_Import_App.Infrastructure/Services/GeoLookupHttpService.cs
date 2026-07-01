using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace CPQ_Import_App.Infrastructure.Services;

public class GeoLookupHttpService(HttpClient httpClient, ILogger<GeoLookupHttpService> logger) : IGeoLookupService
{
    public async Task<GeoLocationResult?> ResolveAsync(string? ipAddress, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(ipAddress) || ipAddress == "::1" || ipAddress == "127.0.0.1")
        {
            return null;
        }

        try
        {
            using var response = await httpClient.GetAsync($"json/{ipAddress}?fields=success,country,city", ct);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            var payload = await JsonSerializer.DeserializeAsync<IpApiResponse>(stream, cancellationToken: ct);
            if (payload is null || !payload.Success)
            {
                return null;
            }

            return new GeoLocationResult(payload.Country, payload.City);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Geo lookup failed for IP {IpAddress}", ipAddress);
            return null;
        }
    }

    private sealed class IpApiResponse
    {
        public bool Success { get; set; }
        public string? Country { get; set; }
        public string? City { get; set; }
    }
}
