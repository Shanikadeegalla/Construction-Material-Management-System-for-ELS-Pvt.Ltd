import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import scrollToElement from '../utils/scrollToElement';

/**
 * Custom hook to manage client-side or server-synced pagination state.
 *
 * @param {Array} data - The array of items to paginate (usually filtered/searched).
 * @param {number} initialPageSize - Default rows per page (default: 10).
 * @param {Array} resetDeps - Array of dependencies (e.g. search/filter values) that trigger reset to page 1.
 * @param {Object|string} options - Configuration object or storageKey string.
 */
export function usePagination(data = [], initialPageSize = 10, resetDeps = [], options = {}) {
  const opts = typeof options === 'string' ? { storageKey: options } : options;
  const storageKey = opts.storageKey || null;
  const tableRef = opts.tableRef || null;
  const syncUrl = opts.syncUrl !== false;

  // 1. Initialize page size from localStorage if available
  const getInitialPageSize = () => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(`cmms_page_size_${storageKey}`);
        if (saved) {
          const parsed = Number(saved);
          if (parsed > 0) return parsed;
        }
      } catch (e) {}
    }
    return initialPageSize;
  };

  // 2. Initialize page number from URL ?page= if available
  const getInitialPage = () => {
    if (syncUrl) {
      try {
        const params = new URLSearchParams(window.location.search);
        const pageParam = Number(params.get('page'));
        if (pageParam && pageParam > 0) return pageParam;
      } catch (e) {}
    }
    return 1;
  };

  const [currentPage, setCurrentPage] = React.useState(getInitialPage);
  const [pageSize, setPageSizeState] = React.useState(getInitialPageSize);

  // Reset to page 1 whenever search, filter, or query parameters change
  React.useEffect(() => {
    setCurrentPage(1);
    if (syncUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', 1);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
  }, resetDeps); // eslint-disable-line

  const totalItems = Array.isArray(data) ? data.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page doesn't exceed total pages if array contracts (e.g. after deletion)
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      const newPage = Math.max(1, totalPages);
      setCurrentPage(newPage);
      if (syncUrl) {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('page', newPage);
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
      }
    }
  }, [totalPages, currentPage, syncUrl]);

  const paginatedData = React.useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const handlePageChange = (page, skipScroll = false) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
    if (syncUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', target);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
    if (!skipScroll && tableRef) {
      scrollToElement(tableRef, { offset: 80, focusFirstInput: false });
    }
  };

  const handlePageSizeChange = (newSize) => {
    const size = Number(newSize) || initialPageSize;
    setPageSizeState(size);
    if (storageKey) {
      try {
        localStorage.setItem(`cmms_page_size_${storageKey}`, size);
      } catch (e) {}
    }
    setCurrentPage(1);
    if (syncUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', 1);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    }
  };

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return {
    currentPage,
    setCurrentPage: handlePageChange,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalPages,
    totalItems,
    paginatedData,
    startIndex,
    endIndex
  };
}

/**
 * Reusable Pagination UI Component
 */
export const Pagination = ({
  pagination,
  currentPage: propCurrentPage,
  totalPages: propTotalPages,
  pageSize: propPageSize,
  totalItems: propTotalItems,
  onPageChange: propOnPageChange,
  onPageSizeChange: propOnPageSizeChange,
  onClearFilters = null,
  pageSizeOptions = [5, 10, 20, 50],
  align = 'space-between',
  style = {},
  className = ''
}) => {
  const currentPage = pagination ? pagination.currentPage : (propCurrentPage || 1);
  const totalPages = pagination ? pagination.totalPages : (propTotalPages || 1);
  const pageSize = pagination ? pagination.pageSize : (propPageSize || 10);
  const totalItems = pagination ? pagination.totalItems : (propTotalItems ?? 0);
  const onPageChange = pagination ? pagination.setCurrentPage : propOnPageChange;
  const onPageSizeChange = pagination ? pagination.setPageSize : propOnPageSizeChange;

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis (e.g. 1 ... 4 5 6 ... 20)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0) {
    return (
      <div
        className={`cmms-pagination-container ${className}`}
        role="navigation"
        aria-label="Pagination"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          marginTop: '12px',
          fontSize: '13px',
          color: 'var(--text-secondary, #64748b)',
          borderTop: '1px solid var(--border, #e2e8f0)',
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '0 0 8px 8px',
          ...style
        }}
      >
        <span>No records found</span>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '500',
              borderRadius: '6px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-card, #ffffff)',
              color: '#2563eb',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`cmms-pagination-container ${className}`}
      role="navigation"
      aria-label="Pagination"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: align === 'space-between' ? 'space-between' : align,
        gap: '12px',
        padding: '12px 16px',
        marginTop: '12px',
        fontSize: '13px',
        borderTop: '1px solid var(--border, #e2e8f0)',
        borderRadius: '0 0 8px 8px',
        background: 'var(--bg-card, #ffffff)',
        color: 'var(--text-primary, #0f172a)',
        ...style
      }}
    >
      {/* Left section: Item range counter & rows per page selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: '500', color: 'var(--text-secondary, #64748b)' }}>
          Showing <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{startIndex}</strong> to{' '}
          <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{endIndex}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{totalItems}</strong> entries
        </span>

        {/* Page size dropdown */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '12px' }}>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                minHeight: '32px',
                borderRadius: '6px',
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--input-bg, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} per page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right section: Pagination Navigation Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {/* First Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
          title="First Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '32px',
            minHeight: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            color: currentPage === 1 ? '#cbd5e1' : 'var(--text-primary, #1e293b)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          title="Previous Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            minHeight: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            color: currentPage === 1 ? '#cbd5e1' : 'var(--text-primary, #1e293b)',
            fontWeight: '500',
            fontSize: '13px',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronLeft size={16} />
          <span>Prev</span>
        </button>

        {/* Mobile Compact Page Indicator */}
        <span
          className="cmms-pagination-mobile-label"
          style={{ display: 'none', fontWeight: '500', fontSize: '13px', margin: '0 6px' }}
        >
          Page {currentPage} of {totalPages}
        </span>

        {/* Full Desktop Page Numbers */}
        <div className="cmms-pagination-page-numbers" style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 6px',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '13px'
                  }}
                >
                  •••
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  minWidth: '32px',
                  minHeight: '32px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
                  background: isActive ? '#2563eb' : 'var(--bg-card, #ffffff)',
                  color: isActive ? '#ffffff' : 'var(--text-primary, #1e293b)',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          title="Next Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            minHeight: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            color: currentPage === totalPages ? '#cbd5e1' : 'var(--text-primary, #1e293b)',
            fontWeight: '500',
            fontSize: '13px',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            gap: '4px',
            transition: 'all 0.15s ease'
          }}
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
          title="Last Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '32px',
            minHeight: '32px',
            borderRadius: '6px',
            border: '1px solid var(--border, #cbd5e1)',
            background: 'var(--bg-card, #ffffff)',
            color: currentPage === totalPages ? '#cbd5e1' : 'var(--text-primary, #1e293b)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
