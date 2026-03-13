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

const getStatusLabel = (status) => {
  if (status === "rotation_required") {
    return "Rotation required";
  }

  if (status === "ready") {
    return "Ready";
  }

  return status;
};

export const FilesPanel = ({ files, onDownload, onShare, onAudit, onDelete }) => (
  <section className="card">
    <div className="section-head">
      <div>
        <h2>Accessible Files</h2>
        <p className="muted">Owners unlock files with a password envelope. Recipients unwrap theirs with ECDH.</p>
      </div>
    </div>

    {files.length === 0 ? (
      <p className="muted">No files yet. Upload one to create the first encrypted object set.</p>
    ) : (
      <div className="file-list">
        {files.map((file) => (
          <article className="file-card" key={file.id}>
            <div className="file-card-top">
              <div>
                <h3>{file.originalName}</h3>
                <div className="meta-pills">
                  <span className="meta-pill">{formatBytes(file.size)}</span>
                  <span className="meta-pill">{file.chunkCount} chunks</span>
                  <span className="meta-pill">role: {file.access.role}</span>
                </div>
              </div>
              <span className={file.status === "rotation_required" ? "status-pill warning-pill" : "status-pill"}>
                {getStatusLabel(file.status)}
              </span>
            </div>

            <div className="file-card-body">
              <p className="muted">
                {file.access.role === "owner"
                  ? "You own this document and can share, audit, revoke grants, or remove it entirely."
                  : "You can decrypt this document locally with the wrapped key granted to your account."}
              </p>
              {file.status === "rotation_required" ? (
                <p className="warning">Key rotation required after a revocation. Re-encrypt before resharing.</p>
              ) : null}
            </div>

            <div className="button-row file-actions">
              <button className="primary" onClick={() => onDownload(file)} type="button">
                Download + decrypt
              </button>
              {file.access.role === "owner" && file.status !== "rotation_required" ? (
                <button onClick={() => onShare(file)} type="button">
                  Share
                </button>
              ) : null}
              {file.access.role === "owner" ? (
                <button onClick={() => onAudit(file)} type="button">
                  Audit log
                </button>
              ) : null}
              {file.access.role === "owner" ? (
                <button className="danger-button" onClick={() => onDelete(file)} type="button">
                  Delete
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);
