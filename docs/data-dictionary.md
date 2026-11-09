# SZ Prime Core Data Dictionary

## customers
One record per person or organisation interacting with the ecosystem.

## service_requests
The operational centre of the system. A customer can have many requests across multiple business units.

## quotations
Commercial offers linked to service requests.

## payments
Payment records linked to service requests. Provider references can later store Yoco identifiers.

## partners
Third-party providers used by ZaNdou Connect, Relocations, Facilities and other units.

## partner_assignments
Links partners to service requests and tracks the commercial assignment.

## customer_notes
Internal notes for customer context and handovers.

## request_events
Append-only activity stream for status changes and operational audit history.

## future tables
- staff_profiles
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
