using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Infrastructure.Parsers;
using System.Text;

namespace CPQ_Import_App.Tests.Parsers;

public class DescriptionParserTests
{
    private readonly DescriptionParser _parser = new();

    [Fact]
    public async Task ParseAsync_ArticleNumberWithSpaces_ReturnsErrorRow()
    {
        var csv = "ArticleNumber,LanguageCode,ShortDescription,LongDescription\nART 001,en-US,Widget,Long text";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "descriptions.csv");

        Assert.Single(rows);
        Assert.Equal(RowStatus.Error, rows[0].Status);
        Assert.Contains(rows[0].Messages, m =>
            m.Field == "ArticleNumber"
            && m.Message.Contains("must not contain spaces", StringComparison.OrdinalIgnoreCase));
    }
}
