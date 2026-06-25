using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Infrastructure.Parsers;
using System.Text;

namespace CPQ_Import_App.Tests.Parsers;

public class CurrencyRateParserTests
{
    private readonly CurrencyRateParser _parser = new();

    [Fact]
    public async Task ParseAsync_ValidCsv_ReturnsValidRows()
    {
        var csv = "FromCurrency,ToCurrency,Rate,ValidFrom\nUSD,EUR,0.92,2024-01-01\nGBP,EUR,1.17,2024-01-01";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "rates.csv");

        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal(RowStatus.Valid, r.Status));
    }

    [Fact]
    public async Task ParseAsync_NegativeRate_ReturnsErrorRow()
    {
        var csv = "FromCurrency,ToCurrency,Rate,ValidFrom\nUSD,EUR,-1.5,2024-01-01";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "rates.csv");

        Assert.Equal(RowStatus.Error, rows[0].Status);
        Assert.Contains(rows[0].Messages, m => m.Field == "Rate");
    }

    [Fact]
    public async Task ParseAsync_InvalidCurrencyCode_ReturnsErrorRow()
    {
        var csv = "FromCurrency,ToCurrency,Rate,ValidFrom\nDOLLAR,EUR,1.0,2024-01-01";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "rates.csv");

        Assert.Equal(RowStatus.Error, rows[0].Status);
        Assert.Contains(rows[0].Messages, m => m.Field == "FromCurrency");
    }
}
