using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CPQ_Import_App.Core.Models;
using Microsoft.IdentityModel.Tokens;

namespace CPQ_Import_App.API.Security;

public class LocalJwtTokenFactory(IConfiguration configuration)
{
    public (string Token, DateTime ExpiresAtUtc) CreateToken(TestUser user)
    {
        var issuer = configuration["Auth:Local:Issuer"] ?? "CPQImportLocal";
        var audience = configuration["Auth:Local:Audience"] ?? "CPQImportLocalClient";
        var signingKey = configuration["Auth:Local:SigningKey"] ?? "ChangeThisLocalSigningKey_AtLeast32Characters!";
        var expiresMinutes = configuration.GetValue<int?>("Auth:Local:TokenExpirationMinutes") ?? 120;

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.DisplayName),
            new("name", user.DisplayName),
            new("preferred_username", user.UserName),
            new("roles", user.Role)
        };

        if (user.IsAdmin)
        {
            claims.Add(new Claim("roles", "cpq-admin"));
        }

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            SecurityAlgorithms.HmacSha256);

        var expires = DateTime.UtcNow.AddMinutes(expiresMinutes);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
