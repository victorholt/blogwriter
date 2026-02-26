interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  rows,
  getKey,
  onRowClick,
  emptyMessage = 'No data',
}: DataTableProps<T>) {
  return (
    <table className="data-table">
      <thead className="data-table__head">
        <tr>
          {columns.map((col) => (
            <th key={col.key} style={col.width ? { width: col.width } : undefined}>
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="data-table__empty">
            <td colSpan={columns.length}>{emptyMessage}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={getKey(row)}
              className={`data-table__row${onRowClick ? ' data-table__row--clickable' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
