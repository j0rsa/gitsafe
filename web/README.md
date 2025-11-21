# GitSafe Web UI

A modern TypeScript React web application for managing GitSafe repositories.

Built with [Bun](https://bun.sh) for fast development and builds.

## Features

- **Dashboard**: View repository statistics and manage repositories
- **Filtering**: Filter repositories by name, URL, and error state
- **Repository Management**: View, sync, and delete repositories
- **Component Library**: Storybook documentation for all components

## Development

### Prerequisites

- [Bun](https://bun.sh) - Fast JavaScript runtime and package manager

  Install Bun:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
  
  Or using npm (if you have Node.js):
  ```bash
  npm install -g bun
  ```

### Install Dependencies

```bash
bun install
```

### Run Development Server

```bash
bun run dev
```

The app will be available at `http://localhost:5173`

### Run Storybook

```bash
bun run storybook
```

Storybook will be available at `http://localhost:6006`

### Build for Production

```bash
bun run build
```

## Components

All components are documented in Storybook:

- **Stats**: Display repository and credential statistics
- **FilterPanel**: Filter repositories by various criteria
- **RepositoryTile**: Display individual repository information
- **Dashboard**: Main application dashboard

## API Integration

The app connects to the GitSafe API running on `http://127.0.0.1:8080` by default. Make sure the backend server is running before using the web UI.

