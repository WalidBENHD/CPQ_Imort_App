using CPQ_Import_App.Core.Enums;
using CPQ_Import_App.Core.Models;
using CPQ_Import_App.Infrastructure.Parsers;
using System.Text;

namespace CPQ_Import_App.Tests.Parsers;

public class ArticleParserTests
{
    private readonly ArticleParser _parser = new();

    [Fact]
    public async Task ParseAsync_ValidCsv_ReturnsAllRowsValid()
    {
        var csv = "ArticleNumber,Name,Category,Unit\nART-001,Widget,Electronics,PCS\nART-002,Gadget,Tools,SET";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "articles.csv");

        Assert.Equal(2, rows.Count);
        Assert.All(rows, r => Assert.Equal(RowStatus.Valid, r.Status));
    }

    [Fact]
    public async Task ParseAsync_MissingArticleNumber_ReturnsErrorRow()
    {
        var csv = "ArticleNumber,Name,Category,Unit\n,Missing Number,Electronics,PCS";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        var rows = await _parser.ParseAsync(stream, "articles.csv");

        Assert.Single(rows);
        Assert.Equal(RowStatus.Error, rows[0].Status);
        Assert.Contains(rows[0].Messages, m => m.Field == "ArticleNumber" && m.Severity == ValidationSeverity.Error);
    }

    [Fact]
    public async Task ParseAsync_MissingRequiredColumn_Throws()
    {
        var csv = "ArticleNumber,Category,Unit\nART-001,Electronics,PCS";
        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(csv));

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            _parser.ParseAsync(stream, "articles.csv"));
    }

    [Fact]
    public void CanParse_ArticleEntityType_ReturnsTrue()
    {
        Assert.True(_parser.CanParse("articles.xlsx", EntityType.Article));
        Assert.False(_parser.CanParse("articles.xlsx", EntityType.PriceList));
    }
}
