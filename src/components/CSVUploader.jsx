/**
 * CSVUploader — drag-and-drop CSV upload with full client-side validation.
 * Validates headers + every row before making any network call.
 * Shows specific, row-level errors. Never crashes silently.
 */
import { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Papa from 'papaparse';
import { validateCSV, MAX_FILE_SIZE_BYTES } from '../lib/csvValidator';

export function CSVUploader({ onUploadSuccess }) {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const processFile = useCallback(
    (file) => {
      setStatus('loading');
      setErrorMessage(null);
      setSuccessMessage(null);

      if (!file.name.toLowerCase().endsWith('.csv')) {
        setStatus('error');
        setErrorMessage('❌ Invalid file type. Please upload a .csv file.');
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setStatus('error');
        setErrorMessage(
          `❌ File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 2 MB.`
        );
        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const validation = validateCSV(results);
          if (!validation.valid) {
            setStatus('error');
            setErrorMessage(validation.error);
            return;
          }
          onUploadSuccess(results.data, validation.rowCount);
          setStatus('success');
          setSuccessMessage(
            `✅ ${validation.rowCount} zones loaded successfully. Dashboard is updating...`
          );
        },
        error: (err) => {
          setStatus('error');
          setErrorMessage(
            `❌ Could not parse file: ${err.message}. Ensure it is a valid UTF-8 CSV.`
          );
        },
      });
    },
    [onUploadSuccess]
  );

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  return (
    <section className="csv-uploader" aria-label="CSV zone data uploader">
      <h2 className="csv-uploader__title">Upload Zone Data</h2>
      <p className="csv-uploader__hint">
        Required columns: <code>zone</code>, <code>occupancy</code> (0–100),{' '}
        <code>timestamp</code>. Max size: 2 MB.
      </p>

      <div
        className={`csv-uploader__dropzone ${isDragOver ? 'csv-uploader__dropzone--active' : ''} ${status === 'error' ? 'csv-uploader__dropzone--error' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Drop CSV file here, or press Enter to browse files"
        aria-describedby="csv-uploader-status"
      >
        <span aria-hidden="true" className="csv-uploader__icon">
          {status === 'loading' ? '⏳' : status === 'success' ? '✅' : '📂'}
        </span>
        <span className="csv-uploader__cta">
          {status === 'loading' ? 'Processing...' : 'Drop CSV here or click to browse'}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="csv-uploader__input"
        aria-label="CSV file input"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div id="csv-uploader-status" aria-live="polite" aria-atomic="true">
        {status === 'error' && errorMessage && (
          <p className="csv-uploader__error" role="alert">
            {errorMessage}
          </p>
        )}
        {status === 'success' && successMessage && (
          <p className="csv-uploader__success" role="status">
            {successMessage}
          </p>
        )}
      </div>
    </section>
  );
}

CSVUploader.propTypes = {
  onUploadSuccess: PropTypes.func.isRequired,
};

export default CSVUploader;
