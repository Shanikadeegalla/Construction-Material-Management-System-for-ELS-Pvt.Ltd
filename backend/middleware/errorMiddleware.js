const renderHtmlErrorPage = (res, statusCode, message) => {
  res.status(statusCode).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Not Found - CMMS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); max-width: 460px; width: 100%; text-align: center; border: 1px solid #e2e8f0; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #0d1b4b; margin: 0 0 12px; font-size: 22px; font-weight: 700; }
    p { color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px; }
    button { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📄</div>
    <h2>File Not Found</h2>
    <p>${message || 'This file was not uploaded or has been removed. Please contact the Store Officer to re-upload it.'}</p>
    <button onclick="window.history.back()">Go Back</button>
  </div>
</body>
</html>
  `);
};

export const notFound = (req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith('/uploads')) {
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml) {
      return renderHtmlErrorPage(res, 404, 'This file was not uploaded or has been removed. Please contact the Store Officer.');
    } else {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
  }

  const error = new Error(`Resource not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProd = process.env.NODE_ENV === 'production';

  if (req.originalUrl && req.originalUrl.startsWith('/uploads')) {
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsHtml) {
      return renderHtmlErrorPage(res, statusCode, 'This file was not uploaded or has been removed. Please contact the Store Officer.');
    } else {
      return res.status(statusCode).json({
        success: false,
        message: 'File not found'
      });
    }
  }

  res.status(statusCode);
  res.json({
    success: false,
    message: isProd && statusCode === 500 ? 'An unexpected server error occurred. Please try again later.' : err.message,
    stack: isProd ? null : err.stack,
  });
};
