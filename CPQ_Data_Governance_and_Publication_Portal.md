# CPQ Data Governance and Publication Portal

## Business Problem, Target Operating Model, and Recommended Product Direction

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Business Problems](#2-current-business-problems)
3. [Recommended Product Positioning](#3-recommended-product-positioning)
4. [Responsibility and Governance Model](#4-responsibility-and-governance-model)
5. [Solving the Missing-Articles Problem](#5-solving-the-missing-articles-problem)
6. [Article and Price History](#6-article-and-price-history)
7. [Currency Management](#7-currency-management)
8. [Unit Management](#8-unit-management)
9. [Recommended Data Domains](#9-recommended-data-domains)
10. [Recommended End-to-End Workflow](#10-recommended-end-to-end-workflow)
11. [Validation and Business Rules](#11-validation-and-business-rules)
12. [Minimum Viable Product](#12-minimum-viable-product)
13. [Features to Avoid or Postpone](#13-features-to-avoid-or-postpone)
14. [Approval by Exception](#14-approval-by-exception)
15. [Adoption and Change Management](#15-adoption-and-change-management)
16. [Success Metrics](#16-success-metrics)
17. [Recommended Product Architecture](#17-recommended-product-architecture)
18. [Prioritized Roadmap](#18-prioritized-roadmap)
19. [Final Recommendation](#19-final-recommendation)

---

# 1. Executive Summary

The proposed application should not be positioned as a simple data-upload tool.

It should become a:

> **CPQ Data Governance and Publication Portal**

Its purpose is to establish a controlled process through which business sites submit, validate, approve, and publish CPQ-related data.

The application should create a clear separation between:

- Business ownership of the data
- Technical validation of the data
- Approval of commercial information
- Publication into CPQ
- Traceability of every change

The central business objective is:

> Reduce manual data-cleaning effort while ensuring that every CPQ data change has an identified owner, approver, effective date, reason, and publication history.

The application should allow the sites to remain accountable for the accuracy and completeness of their data, while the CPQ team remains responsible for data standards, technical controls, and controlled publication.

---

# 2. Current Business Problems

The current annual update process creates several operational and governance issues.

| Problem | Business Consequence |
|---|---|
| Every site sends a different spreadsheet | The CPQ team must interpret, restructure, and clean every file |
| Data formats are inconsistent | Units, currencies, and descriptions require manual correction |
| Articles are sometimes missing | CPQ may contain incomplete or outdated commercial data |
| Prices may use different units or bases | High risk of incorrect calculations and quotations |
| Mid-year price changes are not traceable | It is difficult to identify who changed a value and why |
| Ownership is unclear | The CPQ team becomes responsible for business-data errors |
| There is no authoritative connected source | The CPQ team cannot automatically verify completeness |
| Updates are handled manually | Operational expenses remain high |
| Errors are detected late | Problems may only appear after data reaches CPQ or sales users |

The current process places too much operational and business responsibility on the CPQ team.

---

# 3. Recommended Product Positioning

## 3.1 Product Purpose

The portal should provide a governed self-service process for:

- Data submission
- Data validation
- Data comparison
- Business approval
- Technical approval
- CPQ publication
- Version control
- Traceability
- Rollback

## 3.2 Product Statement

> Provide a governed self-service process for submitting, validating, approving, and publishing CPQ data, where business owners remain accountable for content and the CPQ team ensures technical compliance.

## 3.3 What the Portal Should Not Become

The portal should not become:

- A complex ERP replacement
- A full Product Lifecycle Management system
- A heavily customized workflow engine
- A manual data-entry application for thousands of rows
- A new bottleneck controlled entirely by the CPQ team
- A system that stores only converted values and loses the original source data

---

# 4. Responsibility and Governance Model

A message such as **“Your data, your responsibility”** is useful, but it is not sufficient.

Responsibility must be embedded in roles, approvals, confirmations, and audit records.

## 4.1 Recommended Roles

| Role | Main Responsibility |
|---|---|
| Site Data Contributor | Prepares and submits the data |
| Site Data Owner | Accountable for completeness and business accuracy |
| Site Approver | Formally confirms the submitted data |
| Finance Approver | Owns exchange rates and, where required, price validation |
| CPQ Team | Defines standards, validates technical compatibility, and publishes data |
| System Administrator | Manages users, permissions, reference data, and configuration |

## 4.2 Business Responsibility

The business site should own:

- Article completeness
- Commercial accuracy
- Correct descriptions
- Correct price values
- Correct price basis
- Correct effective dates
- Confirmation that the submission covers the declared scope

## 4.3 CPQ Team Responsibility

The CPQ team should own:

- Data structure
- Validation rules
- Accepted units
- Accepted currency codes
- Technical field compatibility
- Import format
- Publication to CPQ
- Publication monitoring
- Rollback capability
- Auditability

## 4.4 What the CPQ Team Should Not Approve

The CPQ team should not be expected to confirm:

- Whether a price is commercially correct
- Whether the site included every real-world article
- Whether a local market description is commercially appropriate
- Whether a price increase is justified
- Whether a business decision is correct

The CPQ team can validate the format and consistency, but not the commercial truth.

## 4.5 Suggested Contributor Confirmation

> By submitting this data, you confirm that it is complete and accurate for the declared scope. The system validates structure and consistency but does not verify commercial accuracy.

## 4.6 Suggested Approver Confirmation

> I confirm that this submission is complete and commercially accurate for the declared scope and effective date.

---

# 5. Solving the Missing-Articles Problem

## 5.1 Fundamental Limitation

The portal cannot automatically detect an article that:

- Does not exist in the current CPQ database
- Is not included in the uploaded file
- Is not available from another authoritative system

Without an ERP, PIM, or another master-data source, absolute completeness cannot be guaranteed.

The realistic goal is therefore:

> Controlled completeness against a declared scope and the previous approved version.

## 5.2 Scope-Based Submission

Every submission should clearly define its scope.

Recommended scope fields:

- Site
- Product family
- Market
- Customer group
- Price list
- Article category
- Data type
- Effective date
- Full submission or delta submission

## 5.3 Full Snapshot for Annual Updates

For annual updates, the site should submit a complete snapshot for the declared scope.

The application should compare it with the latest approved version.

## 5.4 Automatic Comparison Categories

| Category | Meaning |
|---|---|
| Unchanged | Existing record with no change |
| Modified | Existing record with one or more changed fields |
| New | Record not present in the previous approved version |
| Missing | Previously active record absent from the new submission |
| Discontinued | Record intentionally removed |
| Replaced | Record replaced by another article |
| Out of Scope | Record no longer belongs to the selected scope |
| Invalid | Record failing technical validation |

## 5.5 Missing Article Handling

A missing article should not disappear silently.

The system should require the user to select a reason:

- Discontinued
- Replaced
- Out of scope
- Temporarily unavailable
- Included by mistake in the previous version
- Accidentally omitted
- Other, with mandatory explanation

Example message:

> Article 12345 existed in the previous approved version but is missing from this submission. Please select a reason before continuing.

## 5.6 Full Snapshot vs Delta Upload

Recommended approach:

| Update Type | Recommended Submission |
|---|---|
| Annual update | Full snapshot |
| Large product-family update | Full snapshot |
| Mid-year price correction | Delta update |
| New article introduction | Delta update |
| Description correction | Delta update |
| Currency-rate update | Separate exchange-rate submission |

This creates both control and usability.

---

# 6. Article and Price History

## 6.1 Is History Worth Implementing?

Yes.

A lightweight history function provides significant business value and should not be considered overengineering.

It allows users to answer:

- Who changed the price?
- What was the previous value?
- When did the change become effective?
- Who approved it?
- Why was it changed?
- Which CPQ publication contained the change?
- Can the previous version be restored?

## 6.2 Recommended Approach

Do not build a complex lifecycle-management engine.

Instead:

1. Every approved submission becomes an immutable version.
2. The system compares it with the previous approved version.
3. The changed values are recorded.
4. The article history is reconstructed from the approved versions.

## 6.3 Example Price History

| Version | Effective Date | Price | Changed By | Approved By | Reason |
|---|---|---:|---|---|---|
| 2026.1 | 2026-01-01 | EUR 100 | Site Contributor | Site Manager | Annual update |
| 2026.2 | 2026-03-15 | EUR 108 | Site Contributor | Commercial Manager | Supplier increase |
| 2026.3 | 2026-07-01 | EUR 105 | Site Contributor | Commercial Manager | Price correction |

## 6.4 Minimum Audit Information

Every approved change should record:

- Submission ID
- Data type
- Site
- Declared scope
- Article number
- Original value
- New value
- Submitted by
- Submission date
- Approved by
- Approval date
- Effective-from date
- Effective-to date, when applicable
- Change reason
- Comment
- CPQ publication status
- CPQ publication date
- Published version
- Rollback reference, when applicable

## 6.5 Standard Change Reasons

Recommended predefined values:

- Annual update
- New article
- Discontinued article
- Replacement article
- Price increase
- Price decrease
- Supplier change
- Data correction
- Currency correction
- Description correction
- Unit correction
- Market expansion
- Temporary commercial adjustment
- Other

Free text should be used for explanation, not as the only classification.

---

# 7. Currency Management

## 7.1 Recommended Principle

The application should standardize currency handling, but it should never discard the original commercial value.

For every price, store:

- Original amount
- Original currency
- Price basis
- Effective date
- Market
- Site
- Source
- Approval information

## 7.2 Native and Normalized Values

The system may calculate a normalized value in a company reference currency, but the normalized value should remain derived.

Example:

```text
Original price: 850 USD per 100 pieces
Exchange-rate version: July 2026 Corporate Rates
Normalized price: 7.30 EUR per piece
```

## 7.3 Why the Original Value Must Be Preserved

Preserving the original value allows:

- Commercial traceability
- Recalculation when exchange rates change
- Auditability
- Comparison with source files
- Avoidance of repeated conversion errors
- Clear separation between source value and system-calculated value

## 7.4 Exchange Rates as a Separate Data Domain

Exchange rates should be managed independently from article-price uploads.

Recommended fields:

| Field | Description |
|---|---|
| From Currency | Original currency |
| To Currency | Reference currency |
| Rate | Conversion rate |
| Effective From | Start date |
| Effective To | End date |
| Source | Corporate Finance or approved source |
| Submitted By | Contributor |
| Approved By | Finance approver |
| Version | Exchange-rate version |

Finance should ideally own and approve this information.

---

# 8. Unit Management

## 8.1 Recommended Principle

Units should be standardized, but the commercial meaning must be preserved.

The system should distinguish between:

- Article unit of measure
- Sales unit
- Packaging unit
- Price basis
- Conversion factor

## 8.2 Example

```text
Sales unit: Box
Content: 25 pieces
Price: EUR 250 per box
Normalized price: EUR 10 per piece
```

## 8.3 Controlled Unit List

Possible controlled values:

- Piece
- Box
- Set
- Pair
- Metre
- Square metre
- Kilogram
- Gram
- Litre
- Per 100 pieces
- Per 1,000 pieces

## 8.4 Unit Aliases

The upload validator may recognize aliases such as:

- pcs
- pc
- pieces
- pce
- ea
- each

However, the stored value should always use the company-standard code.

## 8.5 Conversion Rules

Automatic conversion should only happen when a validated conversion rule exists.

The system should never guess a unit conversion.

---

# 9. Recommended Data Domains

The application should not store all information in one large table.

Different data domains have different owners, update frequencies, and approval rules.

## 9.1 Article Master

Recommended fields:

- Article number
- Site
- Product family
- Article category
- Status
- Default unit
- Replacement article
- Effective-from date
- Effective-to date

## 9.2 Descriptions

Recommended fields:

- Article number
- Language
- Description type
- Description text
- Market
- Effective-from date
- Effective-to date

## 9.3 Prices

Recommended fields:

- Article number
- Price list
- Site
- Market
- Amount
- Currency
- Price basis
- Unit
- Effective-from date
- Effective-to date

## 9.4 Exchange Rates

Recommended fields:

- From currency
- To currency
- Rate
- Effective-from date
- Effective-to date
- Source
- Approval
- Version

## 9.5 Reference Data

Recommended fields:

- Approved currencies
- Approved units
- Product families
- Sites
- Markets
- Price lists
- Change reasons
- Article statuses
- Validation thresholds

---

# 10. Recommended End-to-End Workflow

## Step 1: Select the Scope

The user selects:

- Site
- Product family
- Data type
- Market
- Price list
- Effective date
- Full or delta submission

## Step 2: Load the Current Baseline

The system provides:

- Current approved data
- Current CPQ version
- Previous submission
- Downloadable template

## Step 3: Upload the New Data

The portal should initially support Excel or CSV upload.

Manual row-by-row entry should be available only for small corrections.

## Step 4: Perform Automatic Validation

The application validates:

- Mandatory fields
- Duplicate articles
- Currency codes
- Unit codes
- Number formats
- Decimal separators
- Negative prices
- Zero prices
- Effective dates
- Unexpected characters
- Description length
- Unknown article references
- Missing previous articles
- Overlapping validity periods
- Extreme price changes

## Step 5: Display a Reconciliation Report

Example:

```text
2,450 total articles
2,200 unchanged
140 modified
35 new
60 missing
15 rejected
```

The user should be able to:

- Filter by category
- View errors
- Download errors
- Correct the file
- Upload a revised version

## Step 6: Contributor Confirmation

The contributor confirms:

- The declared scope is correct
- The submission is complete
- The business data is accurate

## Step 7: Business Approval

The relevant business owner approves:

- Commercial accuracy
- Completeness
- Effective date
- Exceptional changes

## Step 8: Technical Publication

The CPQ team confirms:

- Technical compatibility
- Validation success
- Import readiness
- Publication timing

## Step 9: Publication Receipt

The system records:

- Published version
- Publication date
- Published by
- Number of records
- Success status
- Rejected records
- Error logs

## Step 10: Rollback

The system should allow restoration of a previous approved version if a critical issue is discovered.

---

# 11. Validation and Business Rules

## 11.1 Blocking Errors

The following issues should block submission:

- Missing mandatory field
- Duplicate article in the same scope
- Unknown currency
- Unknown unit
- Invalid number format
- Negative price
- Invalid effective date
- Missing previously active article without explanation
- Overlapping validity periods
- Missing data owner
- Missing approver
- Invalid product family
- Invalid site
- Invalid article status

## 11.2 Warnings Requiring Confirmation

The following should generate warnings:

- Price changed above a defined percentage
- Unit changed
- Currency changed
- Description changed significantly
- Large number of discontinued articles
- Large number of new articles
- Article reactivated after discontinuation
- Price below or above an expected threshold
- Effective date is in the past
- Effective date is unusually far in the future

## 11.3 Example Warning

> The price of article 12345 increased by 46% compared with the current approved value. Please confirm the change and provide a reason.

## 11.4 Warning Thresholds

Thresholds should be configurable by:

- Product family
- Site
- Currency
- Market
- Price list

However, advanced configurability should be added only after the first working release.

---

# 12. Minimum Viable Product

The first release should focus on a small number of high-value capabilities.

## 12.1 Must-Have Capabilities

1. Standard data structure
2. Data dictionary
3. User authentication
4. Role-based access
5. Site and scope selection
6. Excel or CSV upload
7. Full-snapshot comparison
8. New, changed, unchanged, and missing classification
9. Blocking validation rules
10. Controlled units
11. Controlled currencies
12. Contributor confirmation
13. Business approval
14. Effective dates
15. Lightweight version history
16. Controlled publication to CPQ
17. Publication log
18. Rollback to previous approved version

## 12.2 Valuable Next Capabilities

- Searchable article history
- Price-change warnings
- Site dashboards
- Submission deadlines
- Automatic reminders
- Rejection comments
- Downloadable validation reports
- Mid-year delta updates
- Multiple-language descriptions
- Comparison between any two approved versions

## 12.3 Later Capabilities

- ERP integration
- PIM integration
- APIs
- Automated source extraction
- Advanced analytics
- Machine-learning anomaly detection
- Complex approval chains
- Configurable workflows for every site
- Full product-lifecycle management

---

# 13. Features to Avoid or Postpone

| Feature | Recommendation |
|---|---|
| Full article lifecycle engine | Postpone |
| Basic searchable change history | Build now |
| Submitter, approver, date, and reason | Build now |
| Original and normalized values | Build now |
| Store prices only in EUR | Avoid |
| Preserve original currency | Build now |
| Fully configurable approval workflow | Postpone |
| One contributor and one approver per scope | Build now |
| AI completeness detection | Avoid for now |
| Baseline comparison | Build now |
| ERP integration | Later |
| Automated rollback | Build now |
| Advanced dashboards | Later |
| Complex notification engine | Later |

---

# 14. Approval by Exception

A major risk is turning the CPQ team into a permanent approval bottleneck.

The system should therefore support:

> **Approval by exception**

Instead of checking every row manually, the CPQ team should review only:

- Validation failures
- Missing articles
- Unusual price changes
- Unit changes
- Currency changes
- Exceptional deletions
- Overlapping validity periods

Example:

```text
2,450 submitted records
2,320 passed all rules
90 require business confirmation
25 contain technical errors
15 have unexplained deletions
```

The CPQ team should focus on the exception set rather than reviewing all 2,450 records.

---

# 15. Adoption and Change Management

The portal will create value only if sites actually use it.

## 15.1 Recommended Pilot

Start with:

- One cooperative site
- One product family
- One data domain
- One annual update cycle
- A limited number of approvers

## 15.2 User Experience Principles

The portal should:

- Accept familiar Excel or CSV formats
- Provide templates
- Prepopulate current approved data
- Show clear error messages
- Allow draft saving
- Allow correction and resubmission
- Show workflow status
- Provide downloadable reports
- Avoid unnecessary manual entry
- Avoid excessive mandatory fields

## 15.3 Management Support

Management should formally establish that:

- The portal is the official submission channel
- Site owners remain responsible for business data
- Unapproved spreadsheets will not be published
- Every site must nominate a contributor and approver
- Submission deadlines are mandatory

Without this support, users may continue sending uncontrolled spreadsheets by email.

## 15.4 Rollout Rule

After a successful pilot:

> Stop accepting uncontrolled spreadsheets for the piloted scope.

---

# 16. Success Metrics

## 16.1 Operational Metrics

| Metric | Purpose |
|---|---|
| Hours spent cleaning files | Measures direct operational savings |
| Average validation time | Measures processing efficiency |
| Average publication lead time | Measures workflow performance |
| Number of manual email exchanges | Measures process simplification |
| Number of rejected submissions | Measures submission quality |

## 16.2 Data-Quality Metrics

| Metric | Purpose |
|---|---|
| First-pass acceptance rate | Measures input quality |
| Missing articles detected | Measures completeness control |
| Duplicate articles detected | Measures structural quality |
| Unit inconsistencies detected | Measures standardization |
| Currency inconsistencies detected | Measures financial consistency |
| Price anomalies detected | Measures commercial-risk control |

## 16.3 Governance Metrics

| Metric | Purpose |
|---|---|
| Percentage of records with identified owner | Measures accountability |
| Percentage of changes with approver | Measures governance compliance |
| Percentage of changes with reason | Measures traceability |
| Number of untraceable mid-year changes | Should decrease to zero |
| Percentage of sites submitting on time | Measures adoption |

## 16.4 Business Outcome Metrics

- Reduction in CPQ incidents
- Reduction in pricing errors
- Reduction in quotation corrections
- Faster annual update completion
- Faster mid-year updates
- Lower CPQ-team operational workload
- Higher confidence from sales teams

---

# 17. Recommended Product Architecture

The central object should be a:

> **Data Submission Package**

## 17.1 Submission Package Fields

```text
Submission ID
Site
Data owner
Contributor
Approver
Product scope
Data type
Full or delta submission
Effective date
Uploaded file
Validation result
Comparison result
Contributor confirmation
Business approval
Technical approval
Publication status
Published version
Audit history
Rollback reference
```

## 17.2 Why This Architecture Is Recommended

This structure provides:

- Traceability
- Approval
- Version control
- Rollback
- Completeness comparison
- Clear ownership
- Lower implementation complexity

Article-level history can be generated from all approved submission packages containing that article.

This is simpler than building a complex lifecycle engine for every article.

---

# 18. Prioritized Roadmap

## Phase 1: Governance Foundation

Focus:

- Define roles
- Define ownership
- Define data domains
- Define the data dictionary
- Define units and currencies
- Define approval responsibilities

Deliverables:

- Responsibility matrix
- Data dictionary
- Standard submission template
- Standard confirmation statements
- Validation-rule list

## Phase 2: Controlled Submission MVP

Focus:

- Upload
- Scope selection
- Validation
- Baseline comparison
- Approval
- Publication

Deliverables:

- Login and roles
- File upload
- Validation report
- New, changed, missing classification
- Contributor confirmation
- Business approval
- CPQ publication log

## Phase 3: Traceability and Risk Reduction

Focus:

- History
- Effective dates
- Reasons
- Rollback
- Price-change warnings

Deliverables:

- Article history
- Price history
- Version comparison
- Change-reason categories
- Rollback function
- Exception-based review

## Phase 4: Adoption and Scale

Focus:

- Multi-site rollout
- Dashboards
- Reminders
- Standard operating process

Deliverables:

- Site dashboard
- Submission deadlines
- Reminder notifications
- Adoption metrics
- Training material
- Governance process

## Phase 5: Integration and Automation

Focus:

- External system integration
- Reduced manual uploads
- Advanced analytics

Possible deliverables:

- ERP connector
- PIM connector
- API integration
- Automated exchange-rate import
- Advanced anomaly detection
- Cross-site analytics

---

# 19. Final Recommendation

The first release should solve four questions extremely well:

1. **Who owns the information?**
2. **Is the submission complete against the declared scope and previous approved version?**
3. **Is the data technically valid and standardized?**
4. **Can every published change be traced and reversed?**

The most valuable capabilities are:

- Scope-based submissions
- Full annual snapshots
- Delta updates for mid-year changes
- Automatic comparison with the previous approved version
- Missing-article detection against the baseline
- Controlled units and currencies
- Original and normalized values
- Named contributor and approver
- Effective dates
- Change reasons
- Lightweight history
- Publication logging
- Rollback

The strongest version of the concept is not:

> Sites upload data into CPQ.

It is:

> Sites own and approve their data through a governed process, while the CPQ team controls standards, validation, and publication.

The recommended next business deliverables are:

- A one-page product charter
- A responsibility matrix
- A prioritized feature backlog
- A detailed MVP process flow
- A pilot plan for one site and one product family

## 20. Current Application Fit and Phased Delivery

At this stage, the current app satisfies the scope in a partial but meaningful way: it already delivers the user-facing entry points for login, role-aware access, dataset selection, upload, validation preview, row correction, approval/rejection, dashboards, and operational visibility, which means the core submission journey is demonstrable and usable for a pilot; however, it still only covers the business scope at an estimated 40-50% because the governed back end is not yet complete, and the portal still needs a real data ownership model, baseline comparison against the previous approved version, authoritative version history, controlled publication, and rollback. The recommended phase plan is: **Phase 1 - Governance foundation** to finalize roles, scope, templates, reference data, and validation rules; **Phase 2 - Controlled submission MVP** to implement upload, validation, comparison, approval, and publication for one site and one product family; **Phase 3 - Traceability and risk reduction** to add history, effective dates, change reasons, and rollback; and **Phase 4 - Adoption and scale** to expand to more sites, dashboards, reminders, and operational reporting once the pilot is stable. For the pilot, the business scope is two logical datasets managed in one workflow: **Article Master** and **Basis Price**. The price dataset is intentionally framed as a **unit price** dataset: the file stores the monetary amount as `UnitPrice`, and the article master provides the unit of measure so users can read the value as "price per unit" without ambiguity.

### Phase 1 - Detailed Workplan

To work on Phase 1 in a controlled way, I would start with the business definitions before any technical implementation:

1. Confirm the pilot scope: one site, one product family, two logical datasets, one annual cycle, and a limited approver group.
2. Define the governance model: contributor, data owner, approver, CPQ admin, and system administrator, including who can submit, approve, reject, and publish.
3. Freeze the standard data structure for the pilot: required fields, optional fields, naming conventions, dates, units, currency, and status values.
4. Build the data dictionary: clear field definitions, business meaning, validation expectations, and ownership of each field.
5. Define the reference lists: approved sites, product families, units, and change-reason categories.
6. Write the validation rules: blocking errors, warnings, duplicate logic, missing-data handling, currency rules, and effective-date rules.
7. Agree the confirmation text and approval wording: contributor responsibility statement and approver attestation.
8. Produce the pilot-ready submission template and process flow so the business can test the same path every time.
9. Review the package with the business and CPQ team, then sign off the minimum foundation before moving into the upload and comparison MVP.

### Phase 1 - Work Completed So Far

The app has already been adjusted to reflect the pilot foundations described above. The work completed so far includes:

- Narrowing the pilot scope to one site, one product family, and two logical datasets: **Article Master** and **Basis Price**
- Removing the extra dataset variants that are outside the pilot scope so the application feels focused and easier to govern
- Aligning the import wizard, dataset catalog, and dashboard wording with the Saint-Marcellin / PDU pilot
- Updating the price dataset so it is clearly treated as a **unit price** flow rather than a generic price field
- Adding the article unit of measure so the business can understand what the price applies to
- Updating the upload template and validation rules to use `UnitPrice` and to keep the pricing meaning explicit
- Keeping compatibility with older price files that still use `Price`, so the pilot can move forward without blocking existing test data
- Improving the role and admin experience so the app supports a more realistic governance workflow
- Adding a safe maintenance/reset path for development and test environments so the pilot can be replayed easily
- Reworking the datasets page into a cleaner portfolio view with one concise metadata block per dataset and a collapsible governed structure section
- Replacing repeated dataset requirements cards with a single field dictionary layout so the structure is easier to scan and less repetitive
- Refining the import wizard requirements area into a compact governed field dictionary with a single row per field and clearer validation messaging
- Aligning the datasets and import wizard dark-mode presentation so both views stay readable and consistent in the enterprise theme
- Updating the scope document itself so the business direction, pilot assumptions, and implementation choices stay synchronized

In practical terms, Phase 1 is now no longer only a planning exercise: the app already reflects the chosen pilot structure, the governed template shape, the clearer pricing meaning that the business asked for, and a more polished portfolio presentation for datasets and template structure.

### Phase 2 - Work Completed So Far

The second phase has focused on turning the pilot into a real controlled submission experience rather than a simple upload screen. The work completed so far includes:

- Adding a dataset-level baseline comparison for each approved import, so Article Master and Basis Price are compared against their own latest committed version
- Making the preview treat the first approved upload as an **Initial baseline** and later uploads as an **Annual refresh** against that baseline
- Showing the reconciliation summary directly in the preview with counts for **New**, **Modified**, **Unchanged**, and **Missing** rows
- Adding a row-level comparison column so users can see the status of every row alongside the validation outcome
- Adding a dedicated comparison filter so users can filter the preview by **New**, **Modified**, or **Unchanged** rows
- Keeping the validation filter and the comparison filter separate, so users can manage data quality and baseline change review independently
- Updating the approver action wording to reflect an annual review instead of a generic upload approval
- Improving the preview messaging so the user understands when an upload creates the first baseline and when it is being compared to a previous approved version
- Wiring the comparison logic through the backend, API contract, and frontend preview so the annual-update flow is visible end to end
- Simplifying the datasets page so each governed dataset has a compact card, a single metadata block, and an expandable structure section instead of repeated summary blocks
- Converting the dataset structure into a field-card dictionary so the requirements are readable without forcing a wide, cut-off table layout
- Adding a stable card height behavior so expanding one dataset does not visually stretch the neighboring card
- Extending the same enterprise styling language to the datasets page and import wizard so the portal feels visually consistent across the pilot journey

In practical terms, Phase 2 now gives the pilot a governed comparison workflow: the user can upload a new version, see what changed against the approved baseline, filter the rows by comparison status, correct data where required, and approve the annual refresh with clear business context, while the surrounding dataset pages and wizard now present that process in a cleaner governed portal style.

### Pilot Template - Article Master + Basis Price

For the Saint-Marcellin / PDU pilot, the first submission template should stay focused on the business-critical fields that matter most for governance and publication.

| Field | Required | Meaning | Validation rule | Example |
|---|---|---|---|---|
| Article Number | Yes | Unique commercial item identifier | Must not be empty and must be unique in scope | `PDU-100245` |
| Site | Yes | Site responsible for the data | Must be one of the approved sites | `Saint-Marcellin` |
| Product Family | Yes | Business family of the article | Must match the approved product family list | `PDU` |
| Article Category | Yes | Article classification | Must be a valid reference value | `Standard` |
| Status | Yes | Commercial lifecycle state | Must be a valid status code | `Active` |
| Default Unit | Yes | Main unit of measure | Must be an approved unit | `PC` |
| Effective From | Yes | Start date of validity | Must be a valid date and cannot be empty | `2026-01-01` |
| Effective To | No | End date of validity | Must be after Effective From if filled | `2026-12-31` |
| Replacement Article | No | Superseding article if discontinued | If filled, must exist in scope or reference list | `PDU-100300` |
| Basis Price | Yes | Reference unit price value used by CPQ | Must be numeric and non-negative | `125.50` |
| Currency | Yes | Price currency | Must be an approved currency | `EUR` |
| Price Basis | Yes | Basis for the price | Must be a valid business value and align with the article unit | `Per piece` |
| Unit | Yes | Unit applied to the price | Must be consistent with price basis | `PC` |
| Data Owner | Yes | Business owner accountable for accuracy | Must be a valid user or role assignment | `Jean Dupont` |
| Contributor | Yes | Person preparing the submission | Must be a valid user | `Marie Martin` |
| Approver | Yes | Person approving the data | Must be a valid user with approval rights | `Claire Bernard` |
| Submission Type | Yes | Full snapshot or delta update | Must be `Full` or `Delta` | `Full` |
| Submission Reason | No | Why the submission is being made | Recommended for traceability | `Annual update` |
| Change Reason | No | Why a row changed | Recommended for audited changes | `Price increase` |
| Source File Name | Yes | Original uploaded file name | Auto-captured by the system | `PDU_2026_Update.xlsx` |

#### Blocking rules for the pilot

The following should block submission because they prevent the portal from reliably governing the data:

- Missing Article Number
- Missing Site or Product Family
- Missing Basis Price, Currency, or Price Basis
- Unknown unit
- Duplicate Article Number in the same scope
- Invalid Effective From date
- Missing Data Owner or Approver
- Negative price
- Invalid Replacement Article

#### Warning rules for the pilot

The following should raise warnings first, rather than blocking the submission immediately:

- Effective To missing
- Change Reason missing
- Large price increase
- Unit changed
- Many new articles in one file

#### Recommended pilot position

For the Saint-Marcellin / PDU pilot, the first release should stay focused on:

- Article Master
- Basis Price
- One site
- One product family
- One full snapshot upload
- Blocking validation on critical fields only

This keeps the pilot small enough to deliver quickly, but strong enough to demonstrate real governance value.

## 21. Annual Update Use Case Flow

The annual update should work as a governed full-scope refresh for the pilot:

1. The site opens a new annual submission for Saint-Marcellin and PDU.
2. The portal loads the last approved baseline for the same scope.
3. The user prepares the source file using the controlled template.
4. The file is uploaded into the portal.
5. The system validates the structure, currency, dates, units, and ownership fields.
6. The portal compares the new file against the previous approved version.
7. Each row is classified as new, changed, unchanged, or missing.
8. The user corrects small issues directly or cancels the request and reuploads a corrected file if the issues are widespread.
9. The contributor confirms the submission.
10. The approver reviews only the exceptions and relevant changes.
11. The portal publishes the approved version into CPQ.
12. The system stores the version history, publication log, and rollback reference.

In business terms, the annual update should not feel like a manual file exchange. It should feel like a controlled submission, comparison, approval, and publication process with clear ownership and traceability.
