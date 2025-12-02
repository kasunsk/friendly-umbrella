# Changelog

All notable changes to the Construction Pricing Platform will be documented in this file.

## [Unreleased]

### Added
- **Product Management Actions**: Added Edit, Delete, and Inactive/Activate buttons to each product row in the supplier dashboard
- **Inline Product Details**: Product details now expand inline within the table row instead of showing in a separate section
- **Supplier Contact Information View**: Companies can now view supplier phone number and location by clicking "View Details" on any product
- **Edit Product Modal**: Full-featured product editing interface with form validation
- **Delete Confirmation Modal**: Safe deletion workflow with confirmation dialog
- **Product Status Toggle**: Quick activation/deactivation of products with confirmation

### Changed
- **Company Dashboard Product Details**: Simplified product details view to show only supplier contact information (phone and location) instead of price comparison table
- **Product Table UI**: Enhanced product table with action buttons for better product management
- **Error Handling**: Improved error handling for API delete operations (204 No Content responses)

### Fixed
- **API Delete Handler**: Fixed issue with 204 No Content responses in delete operations
- **Product Details Loading**: Improved loading states and error handling for product details

## [Previous Releases]

### User Registration and Role Management (v1.0.0)
- Comprehensive user registration system with four registration types
- Two-level approval workflow (Super Admin and Tenant Admin)
- Role and permission management system
- Super admin dashboard for tenant management

---

**Note**: This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) principles.

