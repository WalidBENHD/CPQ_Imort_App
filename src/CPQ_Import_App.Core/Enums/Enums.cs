namespace CPQ_Import_App.Core.Enums;

public enum EntityType
{
    Unknown = 0,
    Article = 1,
    PriceList = 2,
    Description = 3,
    CurrencyRate = 4
}

public enum ImportStatus
{
    Pending = 0,
    Processing = 1,
    AwaitingApproval = 2,
    Committed = 3,
    Rejected = 4,
    Failed = 5
}

public enum RowStatus
{
    Valid = 0,
    Warning = 1,
    Error = 2
}

public enum NotificationType
{
    // Import notifications
    ImportUploaded = 1,
    ImportRejected = 2,
    ImportApproved = 3,
    ImportCommitted = 4,
    ImportFailed = 5,
    // User notifications
    UserPendingApproval = 10,
    UserApproved = 11,
    UserRoleChanged = 12,
    UserDeleted = 13
}
