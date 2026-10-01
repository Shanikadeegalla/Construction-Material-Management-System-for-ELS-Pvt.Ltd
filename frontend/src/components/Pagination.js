import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Custom hook to manage client-side pagination state.
 *
 * @param {Array} data - The array of items to paginate (usually filtered/searched).
 * @param {number} initialPageSize - Default rows per page (default: 10).
 * @param {Array} resetDeps - Array of dependencies (e.g. search/filter values) that trigger reset to page 1.
 */
export function usePagination(data = [], initialPageSize = 10, resetDeps = []) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSizeState] = React.useState(initialPageSize);

  // Reset to page 1 whenever search, filter, or query parameters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, resetDeps); // eslint-disable-line

  const totalItems = Array.isArray(data) ? data.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page doesn't exceed total pages if array contracts
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedData = React.useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const handlePageChange = (page) => {
    const target = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(target);
  };

  const handlePageSizeChange = (newSize) => {
    const size = Number(newSize) || initialPageSize;
    setPageSizeState(size);
    setCurrentPage(1);
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
 *
 * Can be used by either:
 *  1) Passing `pagination` object returned by `usePagination()`:
 *     <Pagination pagination={pagination} />
 *  2) Or passing props individually:
 *     <Pagination currentPage={1} totalPages={5} totalItems={42} pageSize={10} onPageChange={...} onPageSizeChange={...} />
 */
export const Pagination = ({
  pagination,
  currentPage: propCurrentPage,
  totalPages: propTotalPages,
  pageSize: propPageSize,
  totalItems: propTotalItems,
  onPageChange: propOnPageChange,
  onPageSizeChange: propOnPageSizeChange,
  pageSizeOptions = [5, 8, 10, 15, 20, 50],
  align = 'space-between',
  style = {},
  className = ''
}) => {
  // Extract values from pagination object if passed, otherwise use individual props
  const currentPage = pagination ? pagination.currentPage : (propCurrentPage || 1);
  const totalPages = pagination ? pagination.totalPages : (propTotalPages || 1);
  const pageSize = pagination ? pagination.pageSize : (propPageSize || 10);
  const totalItems = pagination ? pagination.totalItems : (propTotalItems ?? 0);
  const onPageChange = pagination ? pagination.setCurrentPage : propOnPageChange;
  const onPageSizeChange = pagination ? pagination.setPageSize : propOnPageSizeChange;

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Helper to generate page numbers with ellipsis (e.g. 1, 2, ..., 5, 6, 7, ..., 10)
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          marginTop: '12px',
          fontSize: '13px',
          color: 'var(--text-secondary, #64748b)',
          borderTop: '1px solid var(--border, #e2e8f0)',
          ...style
        }}
      >
        <span>No records found</span>
      </div>
    );
  }

  return (
    <div
      className={`cmms-pagination-container ${className}`}
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
      {/* Left section: Item range counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: '500', color: 'var(--text-secondary, #64748b)' }}>
          Showing <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{startIndex}</strong> to{' '}
          <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{endIndex}</strong> of{' '}
          <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{totalItems}</strong> entries
        </span>

        {/* Page size dropdown */}
        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px' }}>
            <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '12px' }}>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
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
          title="First Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
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
          title="Previous Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            height: '32px',
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

        {/* Page Numbers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '0 4px' }}>
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
                style={{
                  minWidth: '32px',
                  height: '32px',
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
          title="Next Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 10px',
            height: '32px',
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
          title="Last Page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
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
