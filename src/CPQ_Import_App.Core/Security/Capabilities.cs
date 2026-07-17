namespace CPQ_Import_App.Core.Security;

public static class Capabilities
{
    public const string ImportsView = "imports.view";
    public const string ImportsUpload = "imports.upload";
    public const string ImportsCorrectOwn = "imports.correct_own";
    public const string ImportsWithdrawOwn = "imports.withdraw_own";
    public const string ImportsSubmit = "imports.submit";
    public const string ImportsApprove = "imports.approve";
    public const string ImportsReject = "imports.reject";
    public const string ImportsReturnToReview = "imports.return_to_review";
    public const string ImportsPublish = "imports.publish";
    public const string ToolsEvolis = "tools.evolis";
    public const string ToolsEvolisAudit = "tools.evolis.audit";
    public const string AuditView = "audit.view";
    public const string UsersManage = "users.manage";
    public const string RolesManage = "roles.manage";
    public const string UsersAssignRoles = "users.assign_roles";
    public const string SystemMaintenance = "system.maintenance";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        ImportsView, ImportsUpload, ImportsCorrectOwn, ImportsWithdrawOwn, ImportsSubmit,
        ImportsApprove, ImportsReject, ImportsReturnToReview, ImportsPublish, ToolsEvolis, ToolsEvolisAudit,
        AuditView, UsersManage, RolesManage, UsersAssignRoles, SystemMaintenance
    };
}
