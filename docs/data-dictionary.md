# SZ Prime Core Data Dictionary

## Canonical internal business-unit identifiers

| Identifier | Display name |
|---|---|
| `prime_living` | SZ Prime Living Accommodations |
| `prime_relocations` | SZ Prime Relocations |
| `pristine_cleaning` | SZ Pristine Cleaning |
| `prime_plug_connect` | SZ Prime Plug-Connect |
| `prime_facilities` | SZ Prime Facilities |
| `prime_tech_hub` | SZ Prime Tech Hub |
| `prime_business_solutions` | SZ Prime Business Solutions |

## customers
One record per person or organisation interacting with the ecosystem.

## service_requests
The operational centre of the system. A customer can have many requests across multiple business units.

## quotations
Commercial offers linked to service requests.

## payments
Payment records linked to service requests. Provider references can later store Yoco identifiers.

## partners
Third-party providers coordinated primarily through SZ Prime Plug-Connect and other units where required.

## partner_assignments
Links partners to service requests and tracks the commercial assignment.

## customer_notes
Internal notes for customer context and handovers.

## request_events
Append-only activity stream for status changes and operational audit history.

## staff_profiles
Authenticated staff identities, roles and active status.

## future tables
- roles_permissions
- property_listings
- accommodation_enquiries
- tenders
- tender_requirements
- compliance_documents
- chatbot_conversations
- feedback
- recurring_contracts
- invoices
