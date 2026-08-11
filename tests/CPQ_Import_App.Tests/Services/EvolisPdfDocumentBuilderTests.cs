using CPQ_Import_App.API.Services;
using QuestPDF.Infrastructure;

namespace CPQ_Import_App.Tests.Services;

public sealed class EvolisPdfDocumentBuilderTests
{
    [Fact]
    public void Build_CreatesPolishedConfigurationReport()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var content = string.Join(Environment.NewLine,
        [
            "TABLEAU Configuration principale",
            "PANIER-00001",
            "20260811",
            "L,2,LEG-STD-001",
            "L,1,LEG-STD-002",
            "C,LEG-CFG-100,3,Module de commande principal,EUR,125.5000",
            "C,LEG-CFG-110,2,Interface de communication,EUR,48.7500",
            "C,LEG-CFG-120,4,Connecteur industriel renforce,EUR,12.2500",
            "C,LEG-CFG-130,1,Alimentation de securite,EUR,89.9000",
            ";",
            "TABLEAU Configuration secondaire",
            "PANIER-00002",
            "20260901",
            "L,6,LEG-STD-010",
            "C,LEG-CFG-200,5,Capteur de position,EUR,22.4000",
            "C,LEG-CFG-210,5,Cable de liaison haute resistance,EUR,14.6000",
            "C,LEG-CFG-220,2,Boitier de raccordement,EUR,37.8500",
            "C,LEG-CFG-230,1,Kit de fixation complet,EUR,19.9900",
            "C,LEG-CFG-240,2,Protection mecanique,EUR,31.2500"
        ]);

        var pdf = new EvolisPdfDocumentBuilder().Build(content, "Evolis_Configuration_2026.txt");

        var samplePath = Environment.GetEnvironmentVariable("CPQ_REPORT_SAMPLE_PATH");
        if (!string.IsNullOrWhiteSpace(samplePath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(samplePath)!);
            File.WriteAllBytes(samplePath, pdf);
        }

        Assert.True(pdf.Length > 10_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
