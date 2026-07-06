using System.Text;
using CPQ_Import_App.Core.Interfaces;

namespace CPQ_Import_App.Infrastructure.Services;

public class EvolisDecryptorService : IEvolisDecryptorService
{
    private const string CipherKey = "123456789123";

    public async Task<string> DecryptAsync(Stream input, CancellationToken ct = default)
    {
        using var reader = new StreamReader(input, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var text = await reader.ReadToEndAsync();
        var lines = text.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n').Split('\n');

        var output = new List<string>(lines.Length);
        string? currentIdPanier = null;
        string? currentDate = null;
        var expectingIdPanier = false;
        var expectingDate = false;

        foreach (var rawLine in lines)
        {
            ct.ThrowIfCancellationRequested();

            var line = rawLine;

            if (line.StartsWith("TABLEAU ", StringComparison.OrdinalIgnoreCase))
            {
                currentIdPanier = null;
                currentDate = null;
                expectingIdPanier = true;
                expectingDate = false;
                output.Add(line);
                continue;
            }

            if (expectingIdPanier)
            {
                currentIdPanier = NormalizeContextValue(line);
                expectingIdPanier = false;
                expectingDate = true;
                output.Add(line);
                continue;
            }

            if (expectingDate)
            {
                currentDate = NormalizeContextValue(line);
                expectingDate = false;
                output.Add(line);
                continue;
            }

            if (string.IsNullOrWhiteSpace(line) || line == ";" || line.StartsWith("L,", StringComparison.OrdinalIgnoreCase))
            {
                output.Add(line);
                continue;
            }

            if (line.StartsWith("C,", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(currentIdPanier) || string.IsNullOrWhiteSpace(currentDate))
                {
                    throw new InvalidDataException("Encrypted product row found before table context was declared.");
                }

                var parts = line.Split(',', 6, StringSplitOptions.None);
                if (parts.Length != 6)
                {
                    throw new InvalidDataException($"Invalid Evolis row format: '{line}'.");
                }

                var encryptedField = parts[5].Trim();
                parts[5] = DecryptEncryptedField(encryptedField, currentDate, currentIdPanier);
                output.Add(string.Join(',', parts));
                continue;
            }

            output.Add(line);
        }

        return string.Join(Environment.NewLine, output);
    }

    private static string NormalizeContextValue(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length >= 12)
        {
            return trimmed[..12];
        }

        return trimmed.PadRight(12, '0');
    }

    private static string DecryptEncryptedField(string encryptedField, string date, string idPanier)
    {
        if (encryptedField.Length != 36 || encryptedField.Any(character => !char.IsDigit(character)))
        {
            throw new InvalidDataException($"Invalid encrypted price field: '{encryptedField}'.");
        }

        var encryptedChars = new char[12];
        for (var i = 0; i < 12; i++)
        {
            var chunk = encryptedField.Substring(i * 3, 3);
            if (!int.TryParse(chunk, out var code))
            {
                throw new InvalidDataException($"Invalid encrypted chunk: '{chunk}'.");
            }

            encryptedChars[i] = (char)code;
        }

        return Crypte(new string(encryptedChars), date, idPanier);
    }

    private static string Crypte(string pdb, string date, string idPanier)
    {
        if (pdb.Length != 12 || date.Length != 12 || idPanier.Length != 12)
        {
            throw new InvalidDataException("Evolis decryption requires 12-character context values.");
        }

        var output = new StringBuilder(12);
        for (var i = 0; i < 12; i++)
        {
            var code = pdb[i] ^ date[i] ^ idPanier[i] ^ CipherKey[i];
            output.Append((char)code);
        }

        return output.ToString();
    }
}