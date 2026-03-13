import { useEffect, useMemo, useState } from "react";
import { api } from "./api/client.js";
import { AuthCard } from "./components/AuthCard.jsx";
import { FilesPanel } from "./components/FilesPanel.jsx";
import { ShareDialog } from "./components/ShareDialog.jsx";
import { UploadPanel } from "./components/UploadPanel.jsx";
import { downloadDecryptedFile, triggerBrowserDownload } from "./lib/fileAccess.js";

const formatBytes = (value) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const shareTokenFromPath = () => {
  const prefix = "/share/";
  return window.location.pathname.startsWith(prefix) ? window.location.pathname.slice(prefix.length) : null;
};

const PreviewPanel = ({ preview }) =>
  preview ? (
    <section className="card preview-card">
      <div className="section-head">
        <div>
          <h2>Client-side preview</h2>
          <p className="muted">The PDF below was decrypted in the browser and never exposed in plaintext to the API.</p>
        </div>
      </div>
      <iframe src={preview.url} title={preview.name} />
    </section>
  ) : null;

const AuditPanel = ({ audit }) =>
  audit ? (
    <section className="card">
      <div className="section-head">
        <div>
          <h2>Audit trail for {audit.fileName}</h2>
          <p className="muted">Every manifest request, chunk stream, share action, and revocation is tracked here.</p>
        </div>
      </div>

      <div className="audit-list">
        {audit.events.map((event) => (
          <article className="audit-item" key={event.id}>
            <strong>{event.action}</strong>
            <span>{new Date(event.createdAt).toLocaleString()}</span>
            <small>{event.actorEmail || "anonymous link access"}</small>
          </article>
        ))}
      </div>
    </section>
  ) : null;

const Dashboard = () => {
  const [session, setSession] = useState(null);
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [shareTarget, setShareTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [audit, setAudit] = useState(null);
  const summary = useMemo(() => {
    const ownedFiles = files.filter((file) => file.access.role === "owner").length;
    const rotationRequired = files.filter((file) => file.status === "rotation_required").length;
    const totalStored = files.reduce((sum, file) => sum + file.size, 0);

    return {
      fileCount: files.length,
      ownedFiles,
      rotationRequired,
      totalStored
    };
  }, [files]);

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const refreshFiles = async () => {
    if (!session?.token) {
      return;
    }

    try {
      const response = await api.listFiles(session.token);
      setFiles(response.files);
    } catch (error) {
      setStatus(error.message);
    }
  };

  useEffect(() => {
    refreshFiles();
  }, [session?.token]);

  const handleDownload = async (file) => {
    try {
      setStatus("Decrypting file in the browser...");
      const blob = await downloadDecryptedFile({
        token: session.token,
        file,
        grant: file.access,
        password: session.password,
        privateKey: session.privateKey,
        onProgress: ({ current, total }) => setStatus(`Decrypting chunk ${current}/${total}`)
      });

      if (file.mimeType === "application/pdf") {
        if (preview?.url) {
          URL.revokeObjectURL(preview.url);
        }

        setPreview({
          fileId: file.id,
          name: file.originalName,
          url: URL.createObjectURL(blob)
        });
      }

      triggerBrowserDownload(blob, file.originalName);
      setStatus("Download complete.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleAudit = async (file) => {
    try {
      setStatus("Loading audit trail...");
      const response = await api.getAuditTrail(session.token, file.id);
      setAudit({
        fileId: file.id,
        fileName: file.originalName,
        events: response.events
      });
      setStatus("");
    } catch (error) {
      setStatus(error.message);
    }
  };

  const handleDelete = async (file) => {
    const confirmed = window.confirm(`Delete ${file.originalName}? This removes its encrypted chunks and metadata.`);

    if (!confirmed) {
      return;
    }

    try {
      setStatus("Removing encrypted document...");
      await api.deleteFile(session.token, file.id);
      setFiles((current) => current.filter((entry) => entry.id !== file.id));

      if (audit?.fileId === file.id) {
        setAudit(null);
      }

      if (preview?.fileId === file.id && preview.url) {
        URL.revokeObjectURL(preview.url);
        setPreview(null);
      }

      if (shareTarget?.id === file.id) {
        setShareTarget(null);
      }

      setStatus("Document removed.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  if (!session) {
    return (
      <main className="shell auth-shell">
        <AuthCard onAuthenticated={setSession} />
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero card hero-panel">
        <div className="hero-copy">
          <div className="eyebrow">SecureVault dashboard</div>
          <h1>Welcome back, {session.user.name}</h1>
          <p className="muted">
            Files stay encrypted in transit and at rest. The server sees metadata, ACLs, and wrapped key packages only.
          </p>
          <div className="hero-stats">
            <article className="hero-stat">
              <strong>{summary.fileCount}</strong>
              <span>accessible files</span>
            </article>
            <article className="hero-stat">
              <strong>{formatBytes(summary.totalStored)}</strong>
              <span>tracked volume</span>
            </article>
            <article className="hero-stat">
              <strong>{summary.ownedFiles}</strong>
              <span>owner controls</span>
            </article>
            <article className="hero-stat">
              <strong>{summary.rotationRequired}</strong>
              <span>rotation alerts</span>
            </article>
          </div>
        </div>
        <div className="hero-side">
          <div className="session-chip">
            <span className="session-chip-label">Signed in</span>
            <strong>{session.user.email}</strong>
          </div>
          <button
            onClick={() => {
              setSession(null);
              setFiles([]);
              setAudit(null);
              setShareTarget(null);
              setStatus("");
            }}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <UploadPanel session={session} onUploaded={refreshFiles} />
        <FilesPanel
          files={files}
          onDownload={handleDownload}
          onShare={setShareTarget}
          onAudit={handleAudit}
          onDelete={handleDelete}
        />
      </section>

      {status ? <p className="banner">{status}</p> : null}
      <PreviewPanel preview={preview} />
      <AuditPanel audit={audit} />

      {shareTarget ? (
        <ShareDialog
          file={shareTarget}
          session={session}
          onClose={() => {
            setShareTarget(null);
            refreshFiles();
          }}
        />
      ) : null}
    </main>
  );
};

const ShareAccessPage = ({ shareToken }) => {
  const [manifest, setManifest] = useState(null);
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState("Loading secure share...");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.resolveShare(shareToken);
        setManifest(response.file);
        setStatus("");
      } catch (error) {
        setStatus(error.message);
      }
    };

    load();
  }, [shareToken]);

  const download = async () => {
    try {
      setStatus("Decrypting share in your browser...");
      const blob = await downloadDecryptedFile({
        shareToken,
        file: manifest,
        grant: manifest.access,
        passphrase,
        onProgress: ({ current, total }) => setStatus(`Decrypting shared chunk ${current}/${total}`)
      });

      if (manifest.mimeType === "application/pdf") {
        if (preview?.url) {
          URL.revokeObjectURL(preview.url);
        }

        setPreview({
          fileId: manifest.id,
          name: manifest.originalName,
          url: URL.createObjectURL(blob)
        });
      }

      triggerBrowserDownload(blob, manifest.originalName);
      setStatus("Shared file decrypted successfully.");
    } catch (error) {
      setStatus(error.message);
    }
  };

  return (
    <main className="shell auth-shell">
      <section className="card auth-card">
        <div className="eyebrow">Password-protected secure link</div>
        <h1>{manifest ? manifest.originalName : "Secure share"}</h1>
        <p className="muted">
          This share only contains wrapped key material. Enter the passphrase to unwrap the AES file key locally.
        </p>

        {manifest ? (
          <div className="hero-stats share-stats">
            <article className="hero-stat">
              <strong>{formatBytes(manifest.size)}</strong>
              <span>encrypted file size</span>
            </article>
            <article className="hero-stat">
              <strong>{manifest.chunkCount}</strong>
              <span>streamed chunks</span>
            </article>
          </div>
        ) : null}

        <label className="field">
          <span>Share passphrase</span>
          <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
        </label>

        <button className="primary" disabled={!manifest} onClick={download} type="button">
          Download and decrypt
        </button>

        {status ? <p className="muted">{status}</p> : null}
      </section>

      <PreviewPanel preview={preview} />
    </main>
  );
};

export default function App() {
  const shareToken = useMemo(() => shareTokenFromPath(), []);

  return shareToken ? <ShareAccessPage shareToken={shareToken} /> : <Dashboard />;
}
