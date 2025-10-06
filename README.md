# WikiCanvas

A dynamic, interactive canvas application for creating visual wiki-style collages using Electron and HyperApp.

## Getting Started

### How to Use

If you just want to download this, use the github release tab

### Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [pnpm](https://pnpm.io/) package manager

### Installation

Install dependencies:

```bash
pnpm install
```

### Development

Start the application in development mode:

```bash
pnpm start
```

### Building

Package the application:

```bash
pnpm run package
```

Create distributable packages:

```bash
pnpm run make
```

### Scripts

- `pnpm start` - Start the Electron application in development mode
- `pnpm run package` - Package the application for distribution
- `pnpm run make` - Create platform-specific distributables
- `pnpm run publish` - Publish the application
- `pnpm run type-check` - Run TypeScript type checking

## Architecture

- **Frontend**: HyperApp functional framework
- **Desktop**: Electron for cross-platform support
- **State Management**: Custom memento pattern implementation
- **Build System**: Electron Forge

## License

MIT

## Author

Justin Liang (justinliang1020@gmail.com)
