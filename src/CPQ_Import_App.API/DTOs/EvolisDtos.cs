namespace CPQ_Import_App.API.DTOs;

public record EvolisDecryptResponseDto(
    string SourceFileName,
    string DownloadFileName,
    string Content
);