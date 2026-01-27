import React from 'react';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
  className,
}: DataTableProps<T>) {
  const getCellValue = (item: T, column: Column<T>) => {
    if (column.render) {
      return column.render(item);
    }
    const value = item[column.key as keyof T];
    return value !== undefined && value !== null ? String(value) : '-';
  };

  return (
    <Card className={cn('overflow-hidden border-border/50', className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {columns.map((column) => (
              <TableHead
                key={String(column.key)}
                className={cn(
                  'font-semibold text-foreground',
                  column.className
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-32 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item.id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/50'
                )}
              >
                {columns.map((column) => (
                  <TableCell
                    key={`${item.id}-${String(column.key)}`}
                    className={column.className}
                  >
                    {getCellValue(item, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
