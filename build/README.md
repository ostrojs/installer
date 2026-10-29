<div align="center">

# OstroJS Framework Installer

[![npm version](https://img.shields.io/npm/v/@ostro/installer.svg)](https://www.npmjs.com/package/@ostro/installer)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)

Official Command Line Interface (CLI) installer for scaffolding **OstroJS** applications across macOS, Linux, and Windows.

[Website](https://ostrojs.com) • [Documentation](https://ostrojs.com/docs) • [Repository](https://github.com/ostrojs/installer)

</div>

---

## 🚀 Installation

Install the installer globally using `npm`:

```bash
npm install --global @ostro/installer
```

---

## 🛠️ Usage

Create a new OstroJS application by passing the desired project directory name:

```bash
ostro new myapp
```

Navigate into your application directory and start the server:

```bash
cd myapp
node app.js
```

---

## ⚙️ Command Options

| Command / Option | Description |
| :--- | :--- |
| `ostro new <name>` | Scaffolds a new application in `./<name>`. |
| `ostro new .` | Scaffolds a new application directly inside the current directory. |
| `ostro new <name> --force` | Forces creation even if the target directory already exists (overwrites). |
| `ostro new <name> --dev` | Installs the latest development release (`dev-master`). |

---

## 🖥️ Cross-Platform Support

Fully compatible and tested across all major operating systems:

- **macOS** (Intel & Apple Silicon)
- **Linux** (Debian, Ubuntu, RHEL, Alpine, etc.)
- **Windows** (Windows 10, Windows 11, PowerShell, CMD)

---

## 📄 License

The OstroJS Installer is open-sourced software licensed under the [MIT License](LICENSE.md).
