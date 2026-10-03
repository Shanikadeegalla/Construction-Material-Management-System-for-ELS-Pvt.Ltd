import { API_BASE } from '../config';

/**
 * Utility to verify if an uploaded file exists before opening it in a new tab.
 * Prevents raw 404 JSON pages by catching non-200 HTTP responses and notifying the user.
 *
 * @param {string} fileUrl - Relative path (e.g., '/uploads/invoice-123.pdf') or full URL
 * @param {Object} options
 * @param {string} [options.fileType='file'] - 'invoice' | 'quotation' | 'drawing' | 'specification' | 'file'
 * @param {Object} [options.toast] - Toast notification instance from useToast()
 * @param {Function} [options.onLoadingChange] - Callback to toggle loading state on the button
 * @returns {Promise<boolean>} True if file exists and was opened, false otherwise
 */
export const openUploadedFile = async (fileUrl, options = {}) => {
  const { fileType = 'file', toast, onLoadingChange } = options;

  const isInvoice = fileType === 'invoice' || (fileUrl && fileUrl.toLowerCase().includes('invoice'));
  const notFoundMessage = isInvoice
    ? 'Invoice file not found. The file was not uploaded or is no longer available. Please ask the Store Officer to re-upload it.'
    : 'File not found. The file was not uploaded or is no longer available.';

  if (!fileUrl) {
    if (toast && toast.error) toast.error(notFoundMessage);
    else alert(notFoundMessage);
    return false;
  }

  // Construct absolute URL if relative
  let fullUrl = fileUrl;
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    const cleanPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    fullUrl = `${API_BASE}${cleanPath}`;
  }

  if (onLoadingChange) onLoadingChange(true);

  try {
    let res = await fetch(fullUrl, { method: 'HEAD' });

    // Fallback to GET if server or CORS rejects HEAD request
    if (res.status === 405 || res.status === 403) {
      res = await fetch(fullUrl, { method: 'GET' });
    }

    if (res.ok) {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
      return true;
    } else {
      if (toast && toast.error) {
        toast.error(notFoundMessage);
      } else {
        alert(notFoundMessage);
      }
      return false;
    }
  } catch (err) {
    if (toast && toast.error) {
      toast.error(notFoundMessage);
    } else {
      alert(notFoundMessage);
    }
    return false;
  } finally {
    if (onLoadingChange) onLoadingChange(false);
  }
};

export default openUploadedFile;
