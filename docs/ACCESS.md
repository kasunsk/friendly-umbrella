# Accessing the Documentation

The documentation website is integrated into the Construction Pricing Platform frontend application.

## Access URL

Once the frontend server is running, access the documentation at:

**http://localhost:3000/docs**

## Documentation Structure

### User Guide
- Getting Started: `/docs/user-guide/getting-started`
- Supplier Guide: `/docs/user-guide/supplier-guide`
- Company Guide: `/docs/user-guide/company-guide`
- API Testing: `/docs/user-guide/api-testing`

### Technical Documentation
- Architecture: `/docs/technical/architecture`
- API Reference: `/docs/technical/api-reference`
- Setup & Installation: `/docs/technical/setup`
- Deployment: `/docs/technical/deployment`

## Starting the Documentation Server

1. Start the frontend development server:
   ```bash
   npm run dev:frontend
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000/docs
   ```

## Features

- **Responsive Design**: Works on desktop and mobile devices
- **Navigation Sidebar**: Easy navigation between documentation sections
- **Markdown Rendering**: Clean, readable documentation with syntax highlighting
- **Search**: Use browser search (Ctrl+F / Cmd+F) to find content
- **Links**: Internal links between documentation pages

## Documentation Files Location

All documentation markdown files are located in the `docs/` folder at the project root:

```
docs/
├── README.md
├── user-guide/
│   ├── getting-started.md
│   ├── supplier-guide.md
│   ├── company-guide.md
│   └── api-testing.md
└── technical/
    ├── architecture.md
    ├── api-reference.md
    ├── setup.md
    └── deployment.md
```

## Updating Documentation

To update documentation:

1. Edit the markdown files in the `docs/` folder
2. Changes will be reflected immediately when the frontend server is running
3. No rebuild required - documentation is served dynamically

## Production Deployment

The documentation is automatically included when deploying the frontend application. It will be accessible at:

```
https://your-domain.com/docs
```












