namespace CPQ_Import_App.API.Monitoring;

public class AppActivityTrackingOptions
{
    public bool Enabled { get; set; } = true;
    public bool EnableGeoLookup { get; set; } = false;
    public int RetentionDays { get; set; } = 90;
}
