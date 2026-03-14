# SecureVault

[![Frontend: React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=0A0A0A)](https://react.dev/)
[![Backend: Express](https://img.shields.io/badge/Backend-Express-7C3AED?logo=express&logoColor=white)](https://expressjs.com/)
[![Database: MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Crypto: Web Crypto API](https://img.shields.io/badge/Crypto-Web%20Crypto%20API-2563EB?logo=webcomponents.org&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
[![License: MIT](https://img.shields.io/github/license/vishwaswami24/SecureVault?color=22C55E)](LICENSE)

SecureVault is a secure file sharing platform built around zero-knowledge principles.

It encrypts files in the browser before upload, stores only encrypted chunks on the backend, and shares access by wrapping the file key instead of exposing it directly. The project was built as a backend-heavy secure file sharing assignment using a MERN-style architecture.

![Screen Recording](https://github.com/vishwaswami24/SecureVault_VishwaSwami/blob/main/ScreenRecording2026-03-13205301-ezgif.com-video-to-gif-converter.gif?raw=true)

## ✨ Highlights

- 🔒 Client-side file encryption with `AES-256-GCM`
- 📦 Chunked upload flow for large files
- 🔑 `ECDH + HKDF` based secure sharing for registered users
- 🔗 Password-protected secure links for non-registered recipients
- 🗃️ MongoDB-backed ACLs, audit logs, and file metadata
- 👤 Owner-only revocation, deletion, and audit review
- 📄 Client-side PDF decryption and preview

## 🧰 Tech Stack

- Frontend: `React`, `Vite`, `Web Crypto API`
- Backend: `Node.js`, `Express`
- Database: `MongoDB`, `Mongoose`
- Storage: local disk simulation with a clean path to S3-style replacement
- Auth/session model: custom bearer token flow with server-side password hashing

## 🔄 How It Works

1. A user registers and generates an `ECDH P-256` key pair in the browser.
2. The private key is encrypted with the user's password before being stored.
3. When uploading a file, the browser creates a random AES file key.
4. The file is split into chunks and each chunk is encrypted before upload.
5. The backend stores encrypted chunks plus metadata and wrapped key packages.
6. Sharing works by wrapping the AES file key:
   - with the owner's password for owner recovery
   - with `ECDH + HKDF` for registered-user sharing
   - with a passphrase for secure share links
7. During download, the browser unwraps the file key locally and decrypts all chunks locally.

## 🚀 Core Features

### 🔐 Secure Upload

- Files are encrypted entirely in the browser before transfer
- Uploads are chunked to support large payloads
- The backend never receives plaintext file data

### 👥 Sharing and Access Control

- Owner and viewer roles are enforced through MongoDB ACL records
- Registered users receive access through ECDH-wrapped key packages
- Link-based access uses password-wrapped file keys
- Unauthorized users are blocked from manifest and chunk retrieval

### 🧾 Audit and Governance

- Upload start and completion are logged
- Manifest access and chunk streaming are logged
- Share creation and share resolution are logged
- Owners can review audit trails and revoke access

### 🗂️ Lifecycle Actions

- Owners can revoke grants
- Revoked files are marked `rotation_required`
- Owners can fully delete encrypted files and related metadata

## 🧱 Repository Structure

```text
.
|-- client/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- crypto/
|   |   `-- lib/
|-- docs/
|   `-- ENCRYPTION_CONCEPTS.md
|-- server/
|   `-- src/
|       |-- config/
|       |-- controllers/
|       |-- middleware/
|       |-- models/
|       |-- routes/
|       `-- services/
`-- README.md
```

## 🛡️ Security Design Notes

- File contents use `AES-256-GCM`
- Password-derived wrapping uses `PBKDF2-SHA256`
- Registered-user key exchange uses `ECDH P-256`
- Shared-secret key derivation uses `HKDF-SHA256`
- The backend stores wrapped keys only, not raw file keys
- Private sharing keys are encrypted before persistence

### ♻️ Revocation Reality

Cryptographic revocation is only partially enforceable once a recipient has already obtained the decrypted file key.

This project handles revocation by:

- revoking future backend access immediately
- marking the file as `rotation_required`
- incrementing the key version for future redistribution

That means true secure redistribution still requires re-encrypting the file with a fresh AES key.

## ⚙️ Local Setup

### 1. Install dependencies

```bash
npm install
npm install --workspace server
npm install --workspace client
```

### 2. Configure environment files

Create:

- `server/.env` from `server/.env.example`
- `client/.env` from `client/.env.example`

### 3. Start MongoDB

Default local connection:

```bash
mongodb://127.0.0.1:27017/securevault
```

### 4. Run the backend

```bash
npm run dev:server
```

### 5. Run the frontend

```bash
npm run dev:client
```

## 🔌 Main API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/directory`
- `POST /api/files/initiate`
- `PUT /api/files/uploads/:uploadId/chunks/:chunkIndex`
- `POST /api/files/uploads/:uploadId/complete`
- `GET /api/files`
- `GET /api/files/:fileId`
- `GET /api/files/:fileId/chunks/:chunkIndex`
- `POST /api/files/:fileId/share/user`
- `POST /api/files/:fileId/share/link`
- `GET /api/files/:fileId/access`
- `DELETE /api/files/:fileId/access/:grantId`
- `DELETE /api/files/:fileId`
- `GET /api/files/shares/:shareToken`
- `GET /api/audit/:fileId`

## 📚 Documentation

- [Encryption Concepts](docs/ENCRYPTION_CONCEPTS.md)

This document explains the real encryption implementation used in the project with code snippets from the actual source files.
