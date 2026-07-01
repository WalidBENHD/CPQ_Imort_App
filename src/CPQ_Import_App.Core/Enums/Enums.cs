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
    NeedsCorrection = 3,
    Committed = 4,
    Rejected = 5,
    Failed = 6,
    Cancelled = 7
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
    ImportNeedsCorrection = 6,
    // User notifications
    UserPendingApproval = 10,
    UserApproved = 11,
    UserRoleChanged = 12,
    UserDeleted = 13
}

public enum ActivityCategory
{
    Authentication = 1,
    Import = 2,
    Admin = 3,
    Navigation = 4,
    System = 5
}
