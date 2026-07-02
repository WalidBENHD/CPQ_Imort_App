using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Infrastructure.Parsers;
using System.Text;

namespace CPQ_Import_App.Tests.Parsers;

public class PriceListParserTests
{
    private readonly PriceListParser _parser = new();

    [Fact]
    public async Task ParseAsync_ArticleNumberWithSpaces_ReturnsErrorRow()
    {
        var csv = "ArticleNumber,Price,Currency,ValidFrom,ValidTo\nART 001,10.50,USD,2024-01-01,2024-12-31";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "prices.csv");

        Assert.Single(rows);
        Assert.Equal(RowStatus.Error, rows[0].Status);
        Assert.Contains(rows[0].Messages, m =>
            m.Field == "ArticleNumber"
            && m.Message.Contains("must not contain spaces", StringComparison.OrdinalIgnoreCase));
    }
}
