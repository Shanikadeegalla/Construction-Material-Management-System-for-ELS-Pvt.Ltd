import React from 'react';
import Pagination, { usePagination } from './Pagination';

/**
 * Reusable PaginatedTable component that provides standard table layout,
 * sticky headers, pagination, empty state, and loading indicators.
 *
 * @param {Object} props
 * @param {Array} props.data - Array of items to display.
 * @param {Array} props.columns - Column configuration: [{ header: 'Name', render: (item) => item.name }, ...]
 * @param {number} [props.pageSize=10] - Initial rows per page.
 * @param {string} [props.storageKey] - Storage key for remembering page size.
 * @param {Array} [props.resetDeps] - Dependencies that trigger reset to page 1.
 * @param {boolean} [props.loading=false] - Whether data is loading.
 * @param {Function} [props.onClearFilters] - Callback when clicking Clear Filters in empty state.
 * @param {string} [props.emptyMessage="No records found"] - Custom message when data is empty.
 * @param {string} [props.keyField="_id"] - Field to use as row React key.
 * @param {Object} [props.style] - Custom table wrapper inline styles.
 */
export function PaginatedTable({
  data = [],
  columns = [],
  pageSize = 10,
  storageKey = null,
  resetDeps = [],
  loading = false,
  onClearFilters = null,
  emptyMessage = "No records found",
  keyField = "_id",
  style = {}
}) {
  const pagination = usePagination(data, pageSize, resetDeps, { storageKey });
  const tableRef = React.useRef(null);

  return (
    <div
      ref={tableRef}
      className="cmms-paginated-table-wrapper"
      style={{
        background: 'var(--bg-card, #ffffff)',
        borderRadius: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        ...style
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#0d1b4b', color: 'white', position: 'sticky', top: 0, zIndex: 5 }}>
              {columns.map((col, idx) => (
                <th
                  key={col.header || idx}
                  style={{
                    padding: '12px 16px',
                    fontWeight: '600',
                    fontSize: '12.5px',
                    textAlign: col.numeric ? 'right' : (col.align || 'left'),
                    ...col.headerStyle
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                  Loading records...
                </td>
              </tr>
            ) : pagination.paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
                  <div>{emptyMessage}</div>
                  {onClearFilters && (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      style={{
                        marginTop: '8px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#2563eb',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              pagination.paginatedData.map((item, rowIdx) => (
                <tr
                  key={item[keyField] || rowIdx}
                  style={{
                    borderBottom: '1px solid var(--border, #f1f5f9)',
                    background: rowIdx % 2 === 0 ? 'var(--bg-card, #ffffff)' : 'rgba(248, 250, 252, 0.5)',
                    transition: 'background 0.15s ease'
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.header || colIdx}
                      style={{
                        padding: '12px 16px',
                        textAlign: col.numeric ? 'right' : (col.align || 'left'),
                        color: 'var(--text-primary, #0f172a)',
                        ...col.cellStyle
                      }}
                    >
                      {col.render ? col.render(item, rowIdx) : item[col.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && data.length > 0 && (
        <Pagination pagination={pagination} onClearFilters={onClearFilters} />
      )}
    </div>
  );
}

export default PaginatedTable;
