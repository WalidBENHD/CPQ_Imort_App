using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CPQ_Import_App.Core.Models;
using Microsoft.IdentityModel.Tokens;

namespace CPQ_Import_App.API.Security;

public class LocalJwtTokenFactory(IConfiguration configuration)
{
    public (string Token, DateTime ExpiresAtUtc) CreateToken(TestUser user, IEnumerable<string> roles, IEnumerable<string> capabilities)
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
            new("preferred_username", user.UserName)
        };
        claims.AddRange(roles.Select(role => new Claim("roles", role)));
        claims.AddRange(capabilities.Select(capability => new Claim("capabilities", capability)));

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
